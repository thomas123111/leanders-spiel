// ── Utility Functions ──

function vec2(x, y) { return { x: x || 0, y: y || 0 }; }
function vecAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function vecSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function vecMul(v, s) { return { x: v.x * s, y: v.y * s }; }
function vecLength(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
function vecDist(a, b) { return vecLength(vecSub(a, b)); }
function vecNormalize(v) {
    const len = vecLength(v);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}
function angleBetween(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function randRange(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }

function rectOverlap(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function pointInArc(point, origin, angle, arcWidth, radius) {
    const dist = vecDist(point, origin);
    if (dist > radius) return false;
    const a = Math.atan2(point.y - origin.y, point.x - origin.x);
    let diff = a - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) <= arcWidth / 2;
}

function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
}
