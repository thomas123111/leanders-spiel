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
    attackHeld: false,      // Feuer gehalten
    dodgeTriggered: false,
    swapPressed: false,
    abilityPressed: false,
    pausePressed: false,
    isMobile: false,
    lastInput: 'keyboard',  // 'touch' | 'mouse' | 'keyboard'

    // Sticks (HUD-Koordinaten)
    joystick: { active: false, id: null, baseX: 0, baseY: 0, stickX: 0, stickY: 0, startTime: 0 },
    aimJoystick: { active: false, id: null, baseX: 0, baseY: 0, stickX: 0, stickY: 0, startTime: 0, moved: false },
    STICK_RADIUS: 46,
    buttonsDown: {},        // pointerId → Tasten-ID
    _pending: {},           // Tasten, die in diesem Frame ausgelöst wurden
    _lastMoveTap: 0,

    init(canvas) {
        this.canvas = canvas;
        this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (this.isMobile) this.lastInput = 'touch';
        canvas.style.touchAction = 'none';

        window.addEventListener('keydown', e => {
            if (e.repeat && this.keys[e.code] && this.keys[e.code].down) return;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && Game.state === 'PLAYING') e.preventDefault();
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

    _down(e) {
        const p = this._pos(e);
        const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
        this.lastInput = touch ? 'touch' : 'mouse';
        if (touch) this.isMobile = true;
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
            if (e.button === 0) {
                this.mouse.down = true;
                this.mouse.pressed = true;
            }
            return;
        }

        const w = Game.hudW;
        const now = performance.now();
        if (p.x < w * 0.5 && this.joystick.id === null) {
            const j = this.joystick;
            j.id = e.pointerId;
            j.active = true;
            j.baseX = clamp(p.x, this.STICK_RADIUS + 8, w * 0.5 - 20);
            j.baseY = clamp(p.y, this.STICK_RADIUS + 60, Game.hudH - this.STICK_RADIUS - 8);
            j.stickX = p.x;
            j.stickY = p.y;
            j.startTime = now;
            // Doppeltippen links = Ausweichen
            if (now - this._lastMoveTap < 300) this._pending.dodge = true;
            this._lastMoveTap = now;
        } else if (p.x >= w * 0.5 && this.aimJoystick.id === null) {
            const j = this.aimJoystick;
            j.id = e.pointerId;
            j.active = true;
            j.baseX = clamp(p.x, w * 0.5 + 20, w - this.STICK_RADIUS - 8);
            j.baseY = clamp(p.y, this.STICK_RADIUS + 60, Game.hudH - this.STICK_RADIUS - 8);
            j.stickX = p.x;
            j.stickY = p.y;
            j.startTime = now;
            j.moved = false;
            this.attackPressed = true;
            this.attackHeld = true;
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
            return;
        }
        if (e.pointerId === this.joystick.id) {
            this.joystick.stickX = p.x;
            this.joystick.stickY = p.y;
        } else if (e.pointerId === this.aimJoystick.id) {
            this.aimJoystick.stickX = p.x;
            this.aimJoystick.stickY = p.y;
            if (Math.hypot(p.x - this.aimJoystick.baseX, p.y - this.aimJoystick.baseY) > 10) this.aimJoystick.moved = true;
        }
    },

    _up(e) {
        if (this.buttonsDown[e.pointerId]) {
            delete this.buttonsDown[e.pointerId];
            return;
        }
        if (e.pointerType === 'mouse') {
            if (e.button === 0) this.mouse.down = false;
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
            this.attackHeld = false;
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
        this.direction = { x: 0, y: 0 };
    },

    // Umrechnung Welt-Bildschirm (logische Einheiten) → HUD-Koordinaten
    viewToHud(x, y) {
        const k = Game.renderScale / Game.hudScale;
        return { x: x * k, y: y * k };
    },

    update(dt, playerScreenPos) {
        // ── Bewegung ──
        const j = this.joystick;
        if (j.active) {
            const dx = j.stickX - j.baseX;
            const dy = j.stickY - j.baseY;
            const dist = Math.hypot(dx, dy);
            // Stick-Basis folgt dem Daumen, wenn er weit zieht
            if (dist > this.STICK_RADIUS * 1.35) {
                const over = dist - this.STICK_RADIUS * 1.35;
                j.baseX += (dx / dist) * over;
                j.baseY += (dy / dist) * over;
            }
            const dead = 7;
            if (dist > dead) {
                const k = Math.min(1, (dist - dead) / (this.STICK_RADIUS * 0.55));
                this.direction = { x: (dx / dist) * k, y: (dy / dist) * k };
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
            const dx = a.stickX - a.baseX;
            const dy = a.stickY - a.baseY;
            const dist = Math.hypot(dx, dy);
            if (dist > this.STICK_RADIUS * 1.35) {
                const over = dist - this.STICK_RADIUS * 1.35;
                a.baseX += (dx / dist) * over;
                a.baseY += (dy / dist) * over;
            }
            if (dist > 9) {
                this.aimDirection = { x: dx / dist, y: dy / dist };
                this.aimAngle = Math.atan2(dy, dx);
                this.aiming = true;
            }
        } else if (this.lastInput === 'mouse' && playerScreenPos) {
            const ph = this.viewToHud(playerScreenPos.x, playerScreenPos.y);
            this.aimAngle = Math.atan2(this.mouse.y - ph.y, this.mouse.x - ph.x);
            this.aimDirection = { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
            this.aiming = true;
        }

        if (this.lastInput === 'mouse' && !a.active) {
            if (this.mouse.pressed) this.attackPressed = true;
            this.attackHeld = this.mouse.down;
        }
        if (this.lastInput === 'keyboard' && (this._key('KeyJ') || this._key('Enter'))) {
            this.attackHeld = true;
            this.attackPressed = true;
        }

        // ── Tasten ──
        this.dodgeTriggered = !!this._pending.dodge || this._key('Space') || this._key('ShiftLeft') || this._key('ShiftRight');
        this.swapPressed = !!this._pending.swap || this.keyPressed('KeyQ');
        this.abilityPressed = !!this._pending.ability || this.keyPressed('KeyE');
        if (this._pending.pause) this.pausePressed = true;
    },

    postUpdate() {
        this.mouse.pressed = false;
        this.attackPressed = false;
        this.pausePressed = false;
        this._pending = {};
        if (this.lastInput === 'keyboard' && !this.aimJoystick.active && !this.mouse.down) this.attackHeld = false;
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
