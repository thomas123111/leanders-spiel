// ── Ton: prozedurale Effekte über Web Audio (keine Dateien) ──
// Alles läuft über einen Hauptregler (stumm schaltbar) und einen Kompressor gegen Übersteuern.
// Gleiche Geräusche werden gedrosselt, damit viele Treffer auf einmal das Handy nicht überlasten.

const Sound = {
    ctx: null,
    master: null,
    enabled: true,
    muted: false,
    volume: 0.3,
    _last: {},
    _noise: null,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.value = -14;
            comp.ratio.value = 6;
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 1;
            this.master.connect(comp);
            comp.connect(this.ctx.destination);
        } catch (e) {
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    },

    suspend() {
        if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    },

    setMuted(m) {
        this.muted = !!m;
        if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    },

    // Spielt fn(ctx, ziel) ab; gap = Mindestabstand in ms für dieses Geräusch.
    _play(fn, name, gap = 0) {
        if (!this.enabled || !this.ctx || this.muted) return;
        if (name && gap) {
            const now = performance.now();
            if (this._last[name] && now - this._last[name] < gap) return;
            this._last[name] = now;
        }
        this.resume();
        try { fn(this.ctx, this.master); } catch (e) { /* Ton darf nie das Spiel stören */ }
    },

    _tone(type, f0, f1, dur, vol, delay = 0, curve = 'exp') {
        this._play((ctx, out) => {
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(f0, t);
            if (f1 && f1 !== f0) {
                if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
                else osc.frequency.linearRampToValueAtTime(f1, t + dur);
            }
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(this.volume * vol, t + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(gain);
            gain.connect(out);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        });
    },

    _noiseBurst(dur, vol, filterType, freq, delay = 0) {
        this._play((ctx, out) => {
            if (!this._noise) {
                const len = Math.floor(ctx.sampleRate * 0.5);
                const buf = ctx.createBuffer(1, len, ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                this._noise = buf;
            }
            const t = ctx.currentTime + delay;
            const src = ctx.createBufferSource();
            src.buffer = this._noise;
            const filter = ctx.createBiquadFilter();
            filter.type = filterType;
            filter.frequency.value = freq;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(this.volume * vol, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(filter);
            filter.connect(gain);
            gain.connect(out);
            src.start(t, Math.random() * 0.3, dur + 0.05);
        });
    },

    // ── Effekte ──
    hit() {
        this._play(() => {
            this._tone('square', 260, 90, 0.09, 0.45);
            this._noiseBurst(0.06, 0.35, 'bandpass', 1800);
        }, 'hit', 45);
    },

    playerHit() {
        this._play(() => {
            this._tone('sawtooth', 320, 70, 0.25, 0.5);
            this._tone('square', 160, 60, 0.2, 0.25, 0.02);
        }, 'playerHit', 120);
    },

    enemyDeath() {
        this._play(() => {
            this._tone('square', 420, 1300, 0.07, 0.3, 0, 'lin');
            this._tone('triangle', 900, 120, 0.2, 0.35, 0.06);
            this._noiseBurst(0.12, 0.25, 'lowpass', 1400, 0.03);
        }, 'enemyDeath', 60);
    },

    swing() {
        this._play(() => this._noiseBurst(0.09, 0.3, 'highpass', 2200), 'swing', 60);
    },

    chest() {
        this._play(() => {
            [523, 659, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, 0.16, 0.3, i * 0.07));
        }, 'chest', 100);
    },

    coin() {
        this._play(() => {
            this._tone('square', 988, 988, 0.06, 0.16);
            this._tone('square', 1319, 1319, 0.12, 0.16, 0.05);
        }, 'coin', 50);
    },

    key() {
        this._play(() => {
            [659, 784, 988, 1319].forEach((f, i) => this._tone('sine', f, f, 0.22, 0.36, i * 0.09));
        }, 'key', 200);
    },

    ui() {
        this._play(() => this._tone('triangle', 660, 880, 0.06, 0.22), 'ui', 40);
    },

    bossIntro() {
        this._play(() => {
            this._tone('sawtooth', 90, 42, 1.4, 0.5, 0, 'lin');
            this._tone('square', 45, 40, 1.4, 0.25);
            this._noiseBurst(1.2, 0.18, 'lowpass', 300);
        }, 'bossIntro', 500);
    },

    bossDeath() {
        this._play(() => {
            for (let i = 0; i < 6; i++) {
                this._tone(i % 2 ? 'square' : 'sawtooth', 220 + i * 90, 50, 0.3, 0.45, i * 0.13);
                this._noiseBurst(0.25, 0.3, 'lowpass', 900, i * 0.13);
            }
        }, 'bossDeath', 800);
    },

    dodge() {
        this._play(() => {
            this._tone('sine', 280, 720, 0.12, 0.25);
            this._noiseBurst(0.1, 0.12, 'highpass', 3000);
        }, 'dodge', 80);
    },

    shoot() {
        this._play(() => this._tone('square', 820, 220, 0.09, 0.22), 'shoot', 50);
    },

    powerUp() {
        this._play(() => {
            [523, 784, 1047, 1568].forEach((f, i) => this._tone('triangle', f, f * 1.02, 0.14, 0.28, i * 0.06));
        }, 'powerUp', 150);
    },

    worldClear() {
        this._play(() => {
            [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this._tone('triangle', f, f, i === 5 ? 0.6 : 0.2, 0.35, i * 0.13));
        }, 'worldClear', 1000);
    },

    gameOver() {
        this._play(() => {
            [440, 392, 330, 262].forEach((f, i) => this._tone('triangle', f, f * 0.97, 0.3, 0.4, i * 0.22));
        }, 'gameOver', 1000);
    },
};
