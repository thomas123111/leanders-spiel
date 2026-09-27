// ── Eingabe: Touch (zwei Sticks + Tasten), Maus und Tastatur ──
// Koordinaten der Zeiger sind HUD-Koordinaten (CSS-Pixel / uiZoom), siehe Game.hudScale.

const Input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false, pressed: false },
    direction: { x: 0, y: 0 },
    aimAngle: 0,
    aimDirection: { x: 0, y: 0 },
    aiming: false,          // Ziel-Stick oder Maus zielt gerade aktiv
    attackPressed: false,   // einmalig in diesem Frame
    attackHeld: false,      // Feuer gehalten (Stick, Maus oder Taste)
    dodgeTriggered: false,
    swapPressed: false,
    abilityPressed: false,
    pausePressed: false,
    isMobile: false,
    lastInput: 'keyboard',  // zuletzt benutztes Gerät (für Hinweise): 'touch' | 'mouse' | 'keyboard'
    mouseAim: false,        // Maus zielt (unabhängig davon, ob mit Tastatur gelaufen wird)

    // Sticks (HUD-Koordinaten). ox/oy = Versatz Finger→Knopf, damit nur die Bewegung zählt.
    joystick: { active: false, id: null, baseX: 0, baseY: 0, stickX: 0, stickY: 0, ox: 0, oy: 0, startTime: 0 },
    aimJoystick: { active: false, id: null, baseX: 0, baseY: 0, stickX: 0, stickY: 0, ox: 0, oy: 0, startTime: 0, moved: false },
    STICK_RADIUS: 46,
    buttonsDown: {},        // pointerId → Tasten-ID
    _pending: {},           // Tasten, die seit dem letzten Frame ausgelöst wurden
    _lastMoveTap: 0,
    _dodgeBuffer: 0,        // Ausweichen kurz vormerken

    init(canvas) {
        this.canvas = canvas;
        this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (this.isMobile) this.lastInput = 'touch';
        canvas.style.touchAction = 'none';

        window.addEventListener('keydown', e => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && Game.state === 'PLAYING') e.preventDefault();
            // Automatische Wiederholungen nie als neuen Tastendruck werten
            if (e.repeat) return;
            this.keys[e.code] = { down: true, time: performance.now() };
            this.lastInput = 'keyboard';
            if (e.code === 'Escape' || e.code === 'KeyP') this.pausePressed = true;
        });
        window.addEventListener('keyup', e => {
            if (this.keys[e.code]) this.keys[e.code].down = false;
        });
        window.addEventListener('blur', () => this.releaseAll());

        canvas.addEventListener('pointerdown', e => this._down(e));
        canvas.addEventListener('pointermove', e => this._move(e));
        canvas.addEventListener('pointerup', e => this._up(e));
        canvas.addEventListener('pointercancel', e => this._up(e));
        canvas.addEventListener('lostpointercapture', e => this._up(e));
        canvas.addEventListener('contextmenu', e => e.preventDefault());
    },

    _pos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const z = Game.hudScale / (this.canvas.width / Math.max(1, rect.width));
        return { x: (e.clientX - rect.left) / z, y: (e.clientY - rect.top) / z };
    },

    // Stick beim Aufsetzen: Basis in erlaubten Bereich, Knopf AUF die Basis (keine Sofort-Auslenkung)
    _grab(j, e, p, minX, maxX) {
        j.id = e.pointerId;
        j.active = true;
        const R = this.STICK_RADIUS;
        j.baseX = clamp(p.x, minX, maxX);
        j.baseY = clamp(p.y, R + 60, Game.hudH - R - 8);
        j.ox = j.baseX - p.x;
        j.oy = j.baseY - p.y;
        j.stickX = j.baseX;
        j.stickY = j.baseY;
        j.startTime = performance.now();
    },

    _down(e) {
        const p = this._pos(e);
        const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
        this.lastInput = touch ? 'touch' : 'mouse';
        if (touch) {
            this.isMobile = true;
            this.mouseAim = false;
        }
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        if (typeof Sound !== 'undefined' && Sound.resume) Sound.resume();

        // Tasten (Pause, Ausweichen, Waffe, Auto) haben Vorrang
        const btn = typeof HUD !== 'undefined' ? HUD.hitTest(p.x, p.y) : null;
        if (btn) {
            this.buttonsDown[e.pointerId] = btn;
            this._pending[btn] = true;
            e.preventDefault();
            return;
        }

        if (!touch) {
            this.mouse.x = p.x;
            this.mouse.y = p.y;
            this.mouseAim = true;
            if (e.button === 0) {
                this.mouse.down = true;
                this.mouse.pressed = true;
            }
            return;
        }

        const w = Game.hudW;
        const R = this.STICK_RADIUS;
        const now = performance.now();
        if (p.x < w * 0.5 && this.joystick.id === null) {
            this._grab(this.joystick, e, p, R + 8, w * 0.5 - 20);
            // Doppeltippen links = Ausweichen
            if (now - this._lastMoveTap < 300) this._pending.dodge = true;
            this._lastMoveTap = now;
        } else if (p.x >= w * 0.5 && this.aimJoystick.id === null) {
            this._grab(this.aimJoystick, e, p, w * 0.5 + 20, w - R - 8);
            this.aimJoystick.moved = false;
            this.attackPressed = true;
            this.mouse.x = p.x;
            this.mouse.y = p.y;
            this.mouse.pressed = true;
        }
        e.preventDefault();
    },

    _move(e) {
        const p = this._pos(e);
        if (e.pointerType === 'mouse') {
            this.mouse.x = p.x;
            this.mouse.y = p.y;
            this.mouseAim = true;
            return;
        }
        const j = e.pointerId === this.joystick.id ? this.joystick
            : (e.pointerId === this.aimJoystick.id ? this.aimJoystick : null);
        if (!j) return;
        j.stickX = p.x + j.ox;
        j.stickY = p.y + j.oy;
        if (j === this.aimJoystick && Math.hypot(j.stickX - j.baseX, j.stickY - j.baseY) > 10) j.moved = true;
    },

    _up(e) {
        if (this.buttonsDown[e.pointerId]) {
            delete this.buttonsDown[e.pointerId];
            return;
        }
        if (e.pointerType === 'mouse') {
            if (e.button === 0 || e.type !== 'pointerup') this.mouse.down = false;
            return;
        }
        if (e.pointerId === this.joystick.id) {
            this.joystick.id = null;
            this.joystick.active = false;
            this.direction = { x: 0, y: 0 };
        }
        if (e.pointerId === this.aimJoystick.id) {
            this.aimJoystick.id = null;
            this.aimJoystick.active = false;
            this.aimDirection = { x: 0, y: 0 };
        }
    },

    releaseAll() {
        for (const k of Object.keys(this.keys)) this.keys[k].down = false;
        this.joystick.id = null;
        this.joystick.active = false;
        this.aimJoystick.id = null;
        this.aimJoystick.active = false;
        this.buttonsDown = {};
        this.mouse.down = false;
        this.attackHeld = false;
        this.attackPressed = false;
        this._dodgeBuffer = 0;
        this.direction = { x: 0, y: 0 };
    },

    // Nur die gerade gehaltenen Tasten/Angriffe verwerfen, Sticks bleiben (z. B. bei der Boss-Einblendung)
    releaseActions() {
        this.attackPressed = false;
        this._pending = {};
        this._dodgeBuffer = 0;
    },

    // Umrechnung Welt-Bildschirm (logische Einheiten) → HUD-Koordinaten
    viewToHud(x, y) {
        const k = Game.renderScale / Game.hudScale;
        return { x: x * k, y: y * k };
    },

    _stickVector(j, dead) {
        const dx = j.stickX - j.baseX;
        const dy = j.stickY - j.baseY;
        const dist = Math.hypot(dx, dy);
        // Stick-Basis folgt dem Daumen, wenn er weit zieht
        const far = this.STICK_RADIUS * 1.35;
        if (dist > far) {
            const over = dist - far;
            j.baseX += (dx / dist) * over;
            j.baseY += (dy / dist) * over;
        }
        return { dx, dy, dist, dead: dist <= dead };
    },

    update(dt, playerScreenPos) {
        // ── Bewegung ──
        const j = this.joystick;
        if (j.active) {
            const v = this._stickVector(j, 7);
            if (!v.dead) {
                const k = Math.min(1, (v.dist - 7) / (this.STICK_RADIUS * 0.55));
                this.direction = { x: (v.dx / v.dist) * k, y: (v.dy / v.dist) * k };
            } else {
                this.direction = { x: 0, y: 0 };
            }
        } else {
            let dx = 0, dy = 0;
            if (this._key('KeyW') || this._key('ArrowUp')) dy -= 1;
            if (this._key('KeyS') || this._key('ArrowDown')) dy += 1;
            if (this._key('KeyA') || this._key('ArrowLeft')) dx -= 1;
            if (this._key('KeyD') || this._key('ArrowRight')) dx += 1;
            this.direction = vecNormalize({ x: dx, y: dy });
        }

        // ── Zielen ──
        const a = this.aimJoystick;
        this.aiming = false;
        if (a.active) {
            const v = this._stickVector(a, 9);
            if (!v.dead) {
                this.aimDirection = { x: v.dx / v.dist, y: v.dy / v.dist };
                this.aimAngle = Math.atan2(v.dy, v.dx);
                this.aiming = true;
            }
        } else if (this.mouseAim && playerScreenPos) {
            const ph = this.viewToHud(playerScreenPos.x, playerScreenPos.y);
            this.aimAngle = Math.atan2(this.mouse.y - ph.y, this.mouse.x - ph.x);
            this.aimDirection = { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
            this.aiming = true;
        }

        // ── Angriff: jede Quelle einzeln, per ODER ──
        if (this.mouseAim && this.mouse.pressed) this.attackPressed = true;
        const keyAttack = this._key('KeyJ') || this._key('Enter');
        if (keyAttack && this.keyPressed('KeyJ')) this.attackPressed = true;
        this.attackHeld = a.active || (this.mouseAim && this.mouse.down) || keyAttack;

        // ── Tasten ──
        // Ausweichen wird ein paar Bilder vorgemerkt (Doppeltipp: Richtung kommt oft erst danach)
        if (this._pending.dodge || this._key('Space') || this._key('ShiftLeft') || this._key('ShiftRight')) this._dodgeBuffer = 0.15;
        else if (this._dodgeBuffer > 0) this._dodgeBuffer -= dt;
        this.dodgeTriggered = this._dodgeBuffer > 0;
        this.swapPressed = !!this._pending.swap || this.keyPressed('KeyQ');
        this.abilityPressed = !!this._pending.ability || this.keyPressed('KeyE');
        if (this._pending.pause) this.pausePressed = true;
    },

    // Nach erfolgreichem Ausweichen den Vormerker löschen
    consumeDodge() {
        this._dodgeBuffer = 0;
    },

    postUpdate() {
        this.mouse.pressed = false;
        this.attackPressed = false;
        this.pausePressed = false;
        this._pending = {};
    },

    _key(code) {
        return !!(this.keys[code] && this.keys[code].down);
    },

    _keyPressed: {},
    keyPressed(code) {
        const down = this._key(code);
        if (down && !this._keyPressed[code]) {
            this._keyPressed[code] = true;
            return true;
        }
        if (!down) this._keyPressed[code] = false;
        return false;
    },
};
