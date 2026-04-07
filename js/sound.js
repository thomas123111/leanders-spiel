// ── Sound System (Web Audio API - procedural retro sounds) ──

const Sound = {
    ctx: null,
    enabled: true,
    volume: 0.3,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    _play(fn) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        try { fn(this.ctx); } catch (e) {}
    },

    // ── Sound Effects ──

    hit() {
        this._play(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(this.volume * 0.6, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        });
    },

    playerHit() {
        this._play(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        });
    },

    enemyDeath() {
        this._play(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        });
    },

    swing() {
        this._play(ctx => {
            const bufferSize = ctx.sampleRate * 0.08;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 2000;
            gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            source.start(ctx.currentTime);
        });
    },

    chest() {
        this._play(ctx => {
            const t = ctx.currentTime;
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500 + i * 200, t + i * 0.08);
                gain.gain.setValueAtTime(0, t);
                gain.gain.setValueAtTime(this.volume * 0.3, t + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.08);
                osc.stop(t + i * 0.08 + 0.15);
            }
        });
    },

    key() {
        this._play(ctx => {
            const t = ctx.currentTime;
            for (let i = 0; i < 4; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600 + i * 150, t + i * 0.1);
                gain.gain.setValueAtTime(0, t);
                gain.gain.setValueAtTime(this.volume * 0.35, t + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.1);
                osc.stop(t + i * 0.1 + 0.2);
            }
        });
    },

    bossIntro() {
        this._play(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 1);
            gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(this.volume * 0.6, ctx.currentTime + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.5);
        });
    },

    bossDeath() {
        this._play(ctx => {
            const t = ctx.currentTime;
            for (let i = 0; i < 5; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = i % 2 ? 'square' : 'sawtooth';
                osc.frequency.setValueAtTime(200 + i * 100, t + i * 0.15);
                osc.frequency.exponentialRampToValueAtTime(50, t + i * 0.15 + 0.3);
                gain.gain.setValueAtTime(0, t);
                gain.gain.setValueAtTime(this.volume * 0.5, t + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.15);
                osc.stop(t + i * 0.15 + 0.3);
            }
        });
    },

    dodge() {
        this._play(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(this.volume * 0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        });
    },

    shoot() {
        this._play(ctx => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(this.volume * 0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        });
    },

    worldClear() {
        this._play(ctx => {
            const t = ctx.currentTime;
            const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
            for (let i = 0; i < notes.length; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(notes[i], t + i * 0.15);
                gain.gain.setValueAtTime(0, t);
                gain.gain.setValueAtTime(this.volume * 0.35, t + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.15);
                osc.stop(t + i * 0.15 + 0.4);
            }
        });
    },

    gameOver() {
        this._play(ctx => {
            const t = ctx.currentTime;
            const notes = [400, 350, 300, 200];
            for (let i = 0; i < notes.length; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(notes[i], t + i * 0.2);
                gain.gain.setValueAtTime(0, t);
                gain.gain.setValueAtTime(this.volume * 0.4, t + i * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.2 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t + i * 0.2);
                osc.stop(t + i * 0.2 + 0.3);
            }
        });
    }
};
