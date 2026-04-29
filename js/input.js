// ── Input Manager ──

const Input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false, pressed: false },
    direction: { x: 0, y: 0 },
    aimAngle: 0,
    aimDirection: { x: 0, y: 0 },
    attackPressed: false,
    attackHeld: false,
    dodgeTriggered: false,
    isMobile: false,

    // Touch state
    _moveTouch: null,
    _moveTouchStart: null,
    _aimTouch: null,
    _aimTouchStart: null,

    // Dual joystick display
    joystick: { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0 },
    aimJoystick: { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0 },

    // Long press for dodge
    _moveHoldStart: 0,
    DODGE_HOLD_TIME: 400,

    init(canvas) {
        this.canvas = canvas;
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.canvas.tabIndex = 0;
        this.canvas.style.outline = 'none';
        const focusCanvas = () => {
            try {
                this.canvas.focus({ preventScroll: true });
            } catch (e) {
                this.canvas.focus();
            }
        };
        focusCanvas();

        // Keyboard
        window.addEventListener('keydown', e => {
            if (!this.keys[e.code]) this.keys[e.code] = { down: true, time: Date.now() };
            this.keys[e.code].down = true;
        });
        window.addEventListener('keyup', e => {
            if (this.keys[e.code]) this.keys[e.code].down = false;
        });

        // Mouse
        canvas.addEventListener('mousemove', e => {
            this._setMouseFromEvent(e);
        });
        canvas.addEventListener('mousedown', e => {
            this._setMouseFromEvent(e);
            this.mouse.down = true;
            this.mouse.pressed = true;
            focusCanvas();
        });
        canvas.addEventListener('mouseup', e => {
            this._setMouseFromEvent(e);
            this.mouse.down = false;
        });
        canvas.addEventListener('pointerdown', focusCanvas);
        window.addEventListener('pointerdown', focusCanvas, true);

        // Touch
        canvas.addEventListener('touchstart', e => { e.preventDefault(); this._handleTouchStart(e); }, { passive: false });
        canvas.addEventListener('touchmove', e => { e.preventDefault(); this._handleTouchMove(e); }, { passive: false });
        canvas.addEventListener('touchend', e => { e.preventDefault(); this._handleTouchEnd(e); }, { passive: false });
        canvas.addEventListener('touchcancel', e => { e.preventDefault(); this._handleTouchEnd(e); }, { passive: false });
    },

    _setMouseFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouse.x = (e.clientX - rect.left) * scaleX;
        this.mouse.y = (e.clientY - rect.top) * scaleY;
    },

    _handleTouchStart(e) {
        this.attackPressed = true;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Set mouse position from first touch (for button click detection)
        if (e.changedTouches.length > 0) {
            const t0 = e.changedTouches[0];
            this.mouse.x = (t0.clientX - rect.left) * scaleX;
            this.mouse.y = (t0.clientY - rect.top) * scaleY;
            this.mouse.pressed = true;
        }

        for (const touch of e.changedTouches) {
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            const screenHalf = this.canvas.width / 2;

            if (x < screenHalf && this._moveTouch === null) {
                // Left side: movement joystick
                this._moveTouch = touch.identifier;
                this._moveTouchStart = { x, y };
                this._moveHoldStart = Date.now();
                this.joystick.active = true;
                this.joystick.baseX = x;
                this.joystick.baseY = y;
                this.joystick.stickX = x;
                this.joystick.stickY = y;
            } else if (x >= screenHalf && this._aimTouch === null) {
                // Right side: aim joystick
                this._aimTouch = touch.identifier;
                this._aimTouchStart = { x, y };
                this.aimJoystick.active = true;
                this.aimJoystick.baseX = x;
                this.aimJoystick.baseY = y;
                this.aimJoystick.stickX = x;
                this.aimJoystick.stickY = y;
                this.attackHeld = true;
            }
        }
    },

    _handleTouchMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        for (const touch of e.changedTouches) {
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;

            if (touch.identifier === this._moveTouch) {
                this.joystick.stickX = x;
                this.joystick.stickY = y;
            }
            if (touch.identifier === this._aimTouch) {
                this.aimJoystick.stickX = x;
                this.aimJoystick.stickY = y;
            }
        }
    },

    _handleTouchEnd(e) {
        for (const touch of e.changedTouches) {
            if (touch.identifier === this._moveTouch) {
                this._moveTouch = null;
                this._moveTouchStart = null;
                this.joystick.active = false;
                this.direction = { x: 0, y: 0 };
                this._moveHoldStart = 0;
            }
            if (touch.identifier === this._aimTouch) {
                this._aimTouch = null;
                this._aimTouchStart = null;
                this.aimJoystick.active = false;
                this.attackHeld = false;
                this.aimDirection = { x: 0, y: 0 };
            }
        }
    },

    update(dt, playerScreenPos) {
        // ── Movement Direction (left joystick / WASD) ──
        if (this._moveTouch !== null && this._moveTouchStart) {
            const dx = this.joystick.stickX - this.joystick.baseX;
            const dy = this.joystick.stickY - this.joystick.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const deadzone = 10;
            if (dist > deadzone) {
                this.direction = vecNormalize({ x: dx, y: dy });
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

        // ── Aim Direction (right joystick / mouse) ──
        if (this._aimTouch !== null && this._aimTouchStart) {
            const dx = this.aimJoystick.stickX - this.aimJoystick.baseX;
            const dy = this.aimJoystick.stickY - this.aimJoystick.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const deadzone = 8;
            if (dist > deadzone) {
                this.aimDirection = vecNormalize({ x: dx, y: dy });
                this.aimAngle = Math.atan2(dy, dx);
                this.attackPressed = true;
            }
        } else if (playerScreenPos) {
            // Mouse aim on desktop
            this.aimAngle = Math.atan2(
                this.mouse.y - playerScreenPos.y,
                this.mouse.x - playerScreenPos.x
            );
        }

        // ── Attack (mouse click on desktop) ──
        if (!this.isMobile) {
            if (this.mouse.pressed) {
                this.attackPressed = true;
            }
        }

        // ── Dodge (long press / Space) ──
        this.dodgeTriggered = false;
        if (this._key('Space') || this._key('ShiftLeft') || this._key('ShiftRight')) {
            this.dodgeTriggered = true;
        }
        if (this._moveTouch !== null && this._moveHoldStart > 0) {
            const holdTime = Date.now() - this._moveHoldStart;
            if (holdTime > this.DODGE_HOLD_TIME) {
                this.dodgeTriggered = true;
                this._moveHoldStart = 0;
            }
        }
    },

    postUpdate() {
        this.mouse.pressed = false;
        this.attackPressed = false;
    },

    _key(code) {
        return this.keys[code] && this.keys[code].down;
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
    }
};
