// ── Input Manager ──

const Input = {
    keys: {},
    mouse: { x: 0, y: 0, down: false, pressed: false },
    direction: { x: 0, y: 0 },
    aimAngle: 0,
    attackPressed: false,
    dodgeTriggered: false,
    isMobile: false,

    // Touch state
    _touches: {},
    _moveTouch: null,
    _moveTouchStart: null,
    _attackTouch: null,

    // Virtual joystick display
    joystick: { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0 },

    // Long press for dodge
    _moveHoldStart: 0,
    _dodgeCooldown: 0,
    DODGE_HOLD_TIME: 400, // ms

    init(canvas) {
        this.canvas = canvas;
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        });
        canvas.addEventListener('mousedown', e => {
            this.mouse.down = true;
            this.mouse.pressed = true;
        });
        canvas.addEventListener('mouseup', e => {
            this.mouse.down = false;
        });

        // Touch
        canvas.addEventListener('touchstart', e => { e.preventDefault(); this._handleTouchStart(e); }, { passive: false });
        canvas.addEventListener('touchmove', e => { e.preventDefault(); this._handleTouchMove(e); }, { passive: false });
        canvas.addEventListener('touchend', e => { e.preventDefault(); this._handleTouchEnd(e); }, { passive: false });
        canvas.addEventListener('touchcancel', e => { e.preventDefault(); this._handleTouchEnd(e); }, { passive: false });
    },

    _handleTouchStart(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        for (const touch of e.changedTouches) {
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            const screenHalf = this.canvas.width / 2;

            if (x < screenHalf && !this._moveTouch) {
                this._moveTouch = touch.identifier;
                this._moveTouchStart = { x, y };
                this._moveHoldStart = Date.now();
                this.joystick.active = true;
                this.joystick.baseX = x;
                this.joystick.baseY = y;
                this.joystick.stickX = x;
                this.joystick.stickY = y;
            } else if (x >= screenHalf) {
                this._attackTouch = touch.identifier;
                this.attackPressed = true;
            }
        }
    },

    _handleTouchMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        for (const touch of e.changedTouches) {
            if (touch.identifier === this._moveTouch) {
                const x = (touch.clientX - rect.left) * scaleX;
                const y = (touch.clientY - rect.top) * scaleY;
                this.joystick.stickX = x;
                this.joystick.stickY = y;
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
            if (touch.identifier === this._attackTouch) {
                this._attackTouch = null;
            }
        }
    },

    update(dt, playerScreenPos) {
        // ── Direction ──
        if (this._moveTouch !== null && this._moveTouchStart) {
            // Touch joystick
            const dx = this.joystick.stickX - this.joystick.baseX;
            const dy = this.joystick.stickY - this.joystick.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const deadzone = 10;
            if (dist > deadzone) {
                this.direction = vecNormalize({ x: dx, y: dy });
                this.aimAngle = Math.atan2(dy, dx);
            } else {
                this.direction = { x: 0, y: 0 };
            }
        } else {
            // Keyboard
            let dx = 0, dy = 0;
            if (this._key('KeyW') || this._key('ArrowUp')) dy -= 1;
            if (this._key('KeyS') || this._key('ArrowDown')) dy += 1;
            if (this._key('KeyA') || this._key('ArrowLeft')) dx -= 1;
            if (this._key('KeyD') || this._key('ArrowRight')) dx += 1;
            this.direction = vecNormalize({ x: dx, y: dy });

            // Mouse aim
            if (playerScreenPos) {
                this.aimAngle = Math.atan2(
                    this.mouse.y - playerScreenPos.y,
                    this.mouse.x - playerScreenPos.x
                );
            }
        }

        // ── Attack ──
        if (!this.isMobile || this._moveTouch === null) {
            if (this.mouse.pressed) {
                this.attackPressed = true;
            }
        }

        // ── Dodge (long press / Space) ──
        this.dodgeTriggered = false;
        if (this._key('Space') || this._key('ShiftLeft') || this._key('ShiftRight')) {
            this.dodgeTriggered = true;
        }
        // Mobile: long hold on joystick
        if (this._moveTouch !== null && this._moveHoldStart > 0) {
            const holdTime = Date.now() - this._moveHoldStart;
            if (holdTime > this.DODGE_HOLD_TIME) {
                this.dodgeTriggered = true;
                this._moveHoldStart = 0; // prevent re-trigger
            }
        }
    },

    postUpdate() {
        this.mouse.pressed = false;
        this.attackPressed = false;
    },

    _key(code) {
        return this.keys[code] && this.keys[code].down;
    }
};
