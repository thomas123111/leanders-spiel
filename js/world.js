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
        // Fast color cycling in ALL worlds (never black/brown)
        this.colorTimer += dt;
        this.bgHue = (this.bgHue + dt * 80) % 360;
        if (this.bgHue > 15 && this.bgHue < 45) this.bgHue = 45;
    }

    getThemeDraw() {
        const t = this.theme;
        if (t === 'factory') return '_drawFactory';
        if (t === 'cave') return '_drawCave';
        if (t === 'dark') return '_drawDark';
        if (t === 'mushroom') return '_drawMushroom';
        if (t === 'swamp') return '_drawSwamp';
        if (t === 'ice') return '_drawIce';
        if (t === 'volcano') return '_drawVolcano';
        return '_drawCastle';
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

                this[this.getThemeDraw()](ctx, t, pos, x, y);
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

    _drawMushroom(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = `hsl(${this.bgHue}, 30%, 22%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // Moss dots
            ctx.fillStyle = `hsl(${(this.bgHue + 60) % 360}, 50%, 35%)`;
            if ((x + y) % 3 === 0) ctx.fillRect(pos.x + 8, pos.y + 12, 4, 4);
        } else if (t === TILE_FLOOR || t === TILE_DOOR) {
            ctx.fillStyle = `hsl(${this.bgHue}, 20%, 35%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = `hsl(${this.bgHue}, 15%, 30%)`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
        } else if (t === TILE_BOSS_DOOR) {
            this._drawBossDoor(ctx, pos);
        } else if (t === TILE_WINDOW) {
            ctx.fillStyle = `hsl(${this.bgHue}, 30%, 22%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // Small mushroom
            ctx.fillStyle = `hsl(${(this.bgHue + 120) % 360}, 70%, 50%)`;
            ctx.beginPath();
            ctx.arc(pos.x + 16, pos.y + 12, 8, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#DDD';
            ctx.fillRect(pos.x + 14, pos.y + 12, 4, 10);
        }
    }

    _drawSwamp(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = `hsl(${this.bgHue}, 25%, 20%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
        } else if (t === TILE_FLOOR || t === TILE_DOOR) {
            ctx.fillStyle = `hsl(${this.bgHue}, 30%, 32%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // Water ripples
            if ((x + y * 3) % 5 === 0) {
                ctx.strokeStyle = `hsla(${this.bgHue}, 40%, 50%, 0.3)`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.arc(pos.x + 16, pos.y + 16, 6 + Math.sin(Date.now() / 500 + x) * 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (t === TILE_BOSS_DOOR) { this._drawBossDoor(ctx, pos);
        } else if (t === TILE_WINDOW) {
            ctx.fillStyle = `hsl(${this.bgHue}, 25%, 20%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = `hsl(${this.bgHue}, 60%, 45%)`;
            ctx.beginPath();
            ctx.ellipse(pos.x + 16, pos.y + 20, 10, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawIce(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = `hsl(${this.bgHue}, 15%, 55%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(pos.x + 4, pos.y + 4, 12, 8);
        } else if (t === TILE_FLOOR || t === TILE_DOOR) {
            ctx.fillStyle = `hsl(${this.bgHue}, 10%, 70%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = `hsl(${this.bgHue}, 15%, 65%)`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
        } else if (t === TILE_BOSS_DOOR) { this._drawBossDoor(ctx, pos);
        } else if (t === TILE_WINDOW) {
            ctx.fillStyle = `hsl(${this.bgHue}, 15%, 55%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // Icicle
            ctx.fillStyle = '#ADF';
            ctx.beginPath();
            ctx.moveTo(pos.x + 10, pos.y + 8);
            ctx.lineTo(pos.x + 16, pos.y + 26);
            ctx.lineTo(pos.x + 22, pos.y + 8);
            ctx.fill();
        }
    }

    _drawVolcano(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = `hsl(${this.bgHue}, 30%, 20%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // Lava cracks
            if ((x * 7 + y * 3) % 8 === 0) {
                ctx.strokeStyle = `hsl(${(this.bgHue + 30) % 360}, 80%, 50%)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pos.x + 6, pos.y + 10);
                ctx.lineTo(pos.x + 20, pos.y + 22);
                ctx.stroke();
            }
        } else if (t === TILE_FLOOR || t === TILE_DOOR) {
            ctx.fillStyle = `hsl(${this.bgHue}, 20%, 30%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
        } else if (t === TILE_BOSS_DOOR) { this._drawBossDoor(ctx, pos);
        } else if (t === TILE_WINDOW) {
            ctx.fillStyle = `hsl(${this.bgHue}, 30%, 20%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // Lava pool
            ctx.fillStyle = `hsl(${(this.bgHue + 20) % 360}, 90%, 50%)`;
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 200 + x) * 0.2;
            ctx.beginPath();
            ctx.ellipse(pos.x + 16, pos.y + 16, 8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    _drawDark(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = '#2A2020';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#221818';
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (t === TILE_FLOOR || t === TILE_DOOR) {
            ctx.fillStyle = '#3A3535';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#332E2E';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (t === TILE_BOSS_DOOR) {
            this._drawBossDoor(ctx, pos);
        } else if (t === TILE_WINDOW) {
            ctx.fillStyle = '#2A2020';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // Torch bracket
            ctx.fillStyle = '#555';
            ctx.fillRect(pos.x + 13, pos.y + 8, 6, 12);
            // Flame
            ctx.fillStyle = '#F80';
            ctx.beginPath();
            ctx.arc(pos.x + 16, pos.y + 6, 5 + Math.sin(Date.now() / 100 + x) * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FF0';
            ctx.beginPath();
            ctx.arc(pos.x + 16, pos.y + 5, 3, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.globalAlpha = 0.08 + Math.sin(Date.now() / 150 + x) * 0.03;
            ctx.fillStyle = '#F80';
            ctx.beginPath();
            ctx.arc(pos.x + 16, pos.y + 8, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
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

// ── Procedural Level Generator ──
// Generates large, explorable maps with rooms, corridors, and special areas

function generateLevel(width, height, numRooms, seed) {
    const W = TILE_WALL, F = TILE_FLOOR, D = TILE_DOOR, B = TILE_BOSS_DOOR;
    const S = TILE_SPAWN, BS = TILE_BOSS_SPAWN, WN = TILE_WINDOW;

    // Simple seeded random
    let s = seed || 42;
    function rand() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }
    function randI(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }

    // Start with all walls
    const map = [];
    for (let y = 0; y < height; y++) {
        map[y] = [];
        for (let x = 0; x < width; x++) map[y][x] = W;
    }

    // Carve a room
    function carveRoom(rx, ry, rw, rh) {
        for (let y = ry; y < ry + rh && y < height - 1; y++) {
            for (let x = rx; x < rx + rw && x < width - 1; x++) {
                if (x > 0 && y > 0) map[y][x] = F;
            }
        }
    }

    // Add windows to room walls
    function addWindows(rx, ry, rw, rh) {
        // Top and bottom walls
        for (let x = rx + 2; x < rx + rw - 2; x += randI(3, 5)) {
            if (ry > 0 && map[ry - 1] && map[ry - 1][x] === W) map[ry - 1][x] = WN;
            if (ry + rh < height && map[ry + rh] && map[ry + rh][x] === W) map[ry + rh][x] = WN;
        }
        // Left and right walls
        for (let y = ry + 2; y < ry + rh - 2; y += randI(3, 5)) {
            if (rx > 0 && map[y][rx - 1] === W) map[y][rx - 1] = WN;
            if (rx + rw < width && map[y][rx + rw] === W) map[y][rx + rw] = WN;
        }
    }

    // Carve corridor between two points
    function carveCorridor(x1, y1, x2, y2) {
        let x = x1, y = y1;
        while (x !== x2) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                map[y][x] = F;
                if (y + 1 < height - 1) map[y + 1][x] = F;
            }
            x += x < x2 ? 1 : -1;
        }
        while (y !== y2) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                map[y][x] = F;
                if (x + 1 < width - 1) map[y][x + 1] = F;
            }
            y += y < y2 ? 1 : -1;
        }
    }

    // Generate rooms
    const rooms = [];
    for (let i = 0; i < numRooms; i++) {
        const rw = randI(5, 10);
        const rh = randI(5, 8);
        const rx = randI(2, width - rw - 2);
        const ry = randI(2, height - rh - 2);
        carveRoom(rx, ry, rw, rh);
        addWindows(rx, ry, rw, rh);
        rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2) });
    }

    // Sort rooms by position for corridor connection
    rooms.sort((a, b) => a.cx + a.cy - b.cx - b.cy);

    // Connect rooms with corridors
    for (let i = 0; i < rooms.length - 1; i++) {
        carveCorridor(rooms[i].cx, rooms[i].cy, rooms[i + 1].cx, rooms[i + 1].cy);
    }
    // Extra corridors for loops
    for (let i = 0; i < Math.floor(rooms.length / 3); i++) {
        const a = randI(0, rooms.length - 1);
        const b = randI(0, rooms.length - 1);
        if (a !== b) carveCorridor(rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy);
    }

    // Place spawn in first room
    map[rooms[0].cy][rooms[0].cx] = S;

    // ── Boss room: FIXED position at bottom-right, fully isolated ──
    const bossW = 12, bossH = 10;
    const bx1 = width - bossW - 2;
    const by1 = height - bossH - 2;
    const bx2 = width - 2;
    const by2 = height - 2;
    const bossCx = bx1 + Math.floor(bossW / 2);
    const bossCy = by1 + Math.floor(bossH / 2);

    // Clear entire boss area + wall border (overwrite everything)
    for (let y = by1 - 1; y <= by2 + 1; y++) {
        for (let x = bx1 - 1; x <= bx2 + 1; x++) {
            if (y < 0 || y >= height || x < 0 || x >= width) continue;
            if (y <= by1 || y >= by2 || x <= bx1 || x >= bx2) {
                map[y][x] = W;
            } else {
                map[y][x] = F;
            }
        }
    }

    // Windows on boss room walls
    for (let x = bx1 + 3; x < bx2 - 2; x += 3) {
        map[by1][x] = WN;
        map[by2][x] = WN;
    }
    for (let y = by1 + 3; y < by2 - 2; y += 3) {
        map[y][bx1] = WN;
        map[y][bx2] = WN;
    }

    // Boss spawn in center
    map[bossCy][bossCx] = BS;

    // Boss door: single entry on the TOP wall
    const doorX = bossCx;
    const doorY = by1;
    map[doorY][doorX] = B;

    // Antechamber: small room above boss door
    for (let y = doorY - 4; y < doorY; y++) {
        for (let x = doorX - 3; x <= doorX + 3; x++) {
            if (y >= 0 && x >= 0 && x < width) map[y][x] = F;
        }
    }

    // Corridor from nearest regular room to antechamber
    let nearestRoom = rooms[0];
    let nearestDist = 99999;
    for (const r of rooms) {
        const d = Math.abs(r.cx - doorX) + Math.abs(r.cy - (doorY - 3));
        if (d < nearestDist) { nearestDist = d; nearestRoom = r; }
    }
    carveCorridor(nearestRoom.cx, nearestRoom.cy, doorX, doorY - 3);

    // Re-enforce boss door and spawn (corridor may have overwritten them)
    map[doorY][doorX] = B;
    map[bossCy][bossCx] = BS;
    // Re-enforce boss room walls (corridor may have broken through)
    for (let y = by1; y <= by2; y++) {
        for (let x = bx1; x <= bx2; x++) {
            if (y === by1 || y === by2 || x === bx1 || x === bx2) {
                if (map[y][x] !== B) map[y][x] = W;
            }
        }
    }

    return map;
}

// ── Level Data ──

const TUTORIAL_LEVEL = generateLevel(25, 20, 6, 999);
const WORLD1_LEVEL = generateLevel(50, 45, 12, 101);
const WORLD2_LEVEL = generateLevel(55, 45, 14, 202);
const WORLD3_LEVEL = generateLevel(50, 42, 13, 303);
const WORLD4_LEVEL = generateLevel(55, 50, 15, 404);
const WORLD5_LEVEL = generateLevel(52, 48, 14, 505);
const WORLD6_LEVEL = generateLevel(55, 45, 13, 606);
const WORLD7_LEVEL = generateLevel(50, 50, 15, 707);
const WORLD8_LEVEL = generateLevel(55, 52, 16, 808);
