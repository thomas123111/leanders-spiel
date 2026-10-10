// ── Musik: kleine prozedurale Chiptune-Schleifen (keine Dateien) ──
// Jede Stimmung ist ein Akkordzyklus mit Bass, Arpeggio und leichtem Schlagzeug.
// Läuft über Web Audio mit Vorausplanung (stabil, auch wenn ein Bild ruckelt).

const Music = {
    enabled: true,
    volume: 0.1,
    gain: null,
    current: null,
    _timer: 0,
    _next: 0,
    _step: 0,
    _song: null,

    // Stimmungen: bpm, Grundton (MIDI), Akkorde als Stufen [Grundton-Versatz, Moll?], Muster
    SONGS: {
        menu: { bpm: 92, root: 60, chords: [[0, 0], [9, 1], [5, 0], [7, 0]], arp: [0, 1, 2, 1, 0, 1, 2, 3], drums: 'soft', lead: 'triangle' },
        happy: { bpm: 118, root: 62, chords: [[0, 0], [7, 0], [9, 1], [5, 0]], arp: [0, 1, 2, 3, 2, 1, 2, 1], drums: 'pop', lead: 'square' },
        spooky: { bpm: 108, root: 57, chords: [[0, 1], [5, 1], [3, 0], [7, 0]], arp: [0, 2, 1, 2, 0, 2, 3, 2], drums: 'soft', lead: 'triangle' },
        epic: { bpm: 126, root: 52, chords: [[0, 1], [8, 0], [3, 0], [10, 0]], arp: [0, 1, 2, 1, 3, 2, 1, 2], drums: 'rock', lead: 'sawtooth' },
        chill: { bpm: 100, root: 65, chords: [[0, 0], [5, 0], [9, 1], [7, 0]], arp: [0, 2, 1, 3, 1, 2, 0, 2], drums: 'soft', lead: 'triangle' },
        chip: { bpm: 140, root: 60, chords: [[0, 0], [9, 1], [5, 0], [7, 0]], arp: [0, 1, 2, 3, 0, 1, 2, 3], drums: 'pop', lead: 'square' },
        boss: { bpm: 148, root: 50, chords: [[0, 1], [0, 1], [8, 0], [10, 0]], arp: [0, 3, 2, 3, 1, 3, 2, 3], drums: 'rock', lead: 'sawtooth' },
        // Welt 22: schlurfend-gruselig, aber lustig (Dur-Dominante wie in alten Monsterfilmen)
        zombie: { bpm: 96, root: 55, chords: [[0, 1], [3, 0], [8, 0], [7, 0]], arp: [0, 2, 1, 2, 3, 2, 1, 2], drums: 'soft', lead: 'square' },
        // Welt 23: schwebend und hell (zweite Stufe in Dur klingt verzaubert)
        dream: { bpm: 112, root: 67, chords: [[0, 0], [2, 0], [9, 1], [4, 1]], arp: [0, 1, 2, 3, 2, 3, 1, 2], drums: 'soft', lead: 'triangle' },
        // Welt 24: heldenhaft und groß (Moll mit Dur-Aufhellung, treibend)
        dragon: { bpm: 132, root: 50, chords: [[0, 1], [10, 0], [8, 0], [7, 0]], arp: [0, 1, 2, 3, 2, 1, 3, 2], drums: 'rock', lead: 'sawtooth' },
        // Welt 25: Heulen im Mondlicht (Moll, langsam schleichend)
        howl: { bpm: 104, root: 53, chords: [[0, 1], [8, 0], [5, 1], [7, 0]], arp: [0, 2, 3, 2, 1, 2, 3, 1], drums: 'soft', lead: 'triangle' },
        // Welt 26: hell und feierlich, aber mit bösem Moll-Ende
        heaven: { bpm: 116, root: 64, chords: [[0, 0], [5, 0], [8, 0], [7, 1]], arp: [0, 1, 2, 3, 3, 2, 1, 0], drums: 'pop', lead: 'triangle' },
        // Welt 27: orientalisch-geheimnisvoll (kleine Sekunde)
        tomb: { bpm: 110, root: 52, chords: [[0, 1], [1, 0], [0, 1], [7, 0]], arp: [0, 1, 2, 1, 3, 2, 1, 2], drums: 'soft', lead: 'square' },
        // Welt 28: stampfend wie Hämmer auf dem Amboss
        forge: { bpm: 136, root: 48, chords: [[0, 1], [3, 0], [10, 0], [7, 0]], arp: [0, 0, 2, 1, 0, 0, 3, 2], drums: 'rock', lead: 'sawtooth' },
        // Welt 29: schnell und knisternd
        storm: { bpm: 150, root: 57, chords: [[0, 1], [10, 0], [8, 0], [10, 0]], arp: [0, 3, 1, 3, 2, 3, 1, 3], drums: 'pop', lead: 'square' },
        // Welt 30: Hexentanz zum Finale
        witch: { bpm: 128, root: 55, chords: [[0, 1], [6, 0], [3, 0], [7, 0]], arp: [0, 2, 1, 3, 2, 1, 3, 2], drums: 'rock', lead: 'sawtooth' },
    },

    THEME_MOOD: {
        training: 'happy', castle: 'spooky', factory: 'epic', slime: 'happy', shadowcastle: 'spooky',
        mushroom: 'chill', swamp: 'chill', ice: 'chill', volcano: 'epic', shadow: 'spooky', orchard: 'happy',
        pixel: 'chip', space: 'chip', bones: 'spooky', poison: 'spooky', stone: 'epic', dojo: 'happy',
        dino: 'happy', chrono: 'chip', shadowswamp: 'spooky', football: 'happy', scrap: 'epic',
        zombie: 'zombie', butterfly: 'dream', dragon: 'dragon',
        werewolf: 'howl', angel: 'heaven', mummy: 'tomb', firepig: 'forge', thunder: 'storm', witch: 'witch',
        bunny: 'happy', devil: 'witch', alien: 'chip', spider: 'spooky', toad: 'zombie', dwarf: 'happy',
        treemonster: 'chill', golem: 'forge', pumpkin: 'howl', crab: 'happy', eagle: 'heaven', fox: 'epic', porcupine: 'chill',
        gorilla: 'epic',
    },

    _ensure() {
        if (this.gain || !Sound.ctx) return !!this.gain;
        this.gain = Sound.ctx.createGain();
        this.gain.gain.value = this._level();
        this.gain.connect(Sound.comp || Sound.ctx.destination);
        return true;
    },

    _ducked: false,

    _level() {
        return this.enabled ? this.volume * (this._ducked ? 0.35 : 1) : 0;
    },

    setEnabled(on) {
        this.enabled = !!on;
        if (this.gain) this.gain.gain.setTargetAtTime(this._level(), Sound.ctx.currentTime, 0.1);
        // Beim Wiedereinschalten sauber neu ansetzen
        if (this.enabled && Sound.ctx) this._next = Sound.ctx.currentTime + 0.1;
    },

    // In der Pause leiser
    duck(on) {
        this._ducked = !!on;
        if (this.gain) this.gain.gain.setTargetAtTime(this._level(), Sound.ctx.currentTime, 0.15);
    },

    // Stimmung starten (gleiche Stimmung läuft einfach weiter)
    play(name) {
        if (!Sound.ctx || !this._ensure()) return;
        if (this.current === name) return;
        this.current = name;
        this._song = this.SONGS[name] || this.SONGS.menu;
        this._step = 0;
        this._next = Sound.ctx.currentTime + 0.12;
        if (!this._timer) this._timer = setInterval(() => this._tick(), 40);
    },

    playForWorld(theme) {
        this.play(this.THEME_MOOD[theme] || 'happy');
    },

    stop() {
        this.current = null;
        this._song = null;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = 0;
        }
    },

    _tick() {
        const ctx = Sound.ctx;
        // Ausgeschaltet oder angehalten: gar nichts erzeugen (spart Akku)
        if (!ctx || !this._song || !this.enabled || ctx.state !== 'running') return;
        const stepDur = 60 / this._song.bpm / 2; // Achtel
        if (this._next < ctx.currentTime - 0.3) this._next = ctx.currentTime + 0.05; // nach Pause neu ansetzen
        while (this._next < ctx.currentTime + 0.25) {
            this._playStep(this._step, this._next, stepDur);
            this._next += stepDur;
            this._step++;
        }
    },

    _freq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    },

    _note(type, midi, t, dur, vol, filter) {
        const ctx = Sound.ctx;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(this._freq(midi), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        let node = osc;
        if (filter) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = filter;
            osc.connect(f);
            node = f;
        }
        node.connect(g);
        g.connect(this.gain);
        osc.start(t);
        osc.stop(t + dur + 0.03);
    },

    _drum(kind, t, vol) {
        const ctx = Sound.ctx;
        if (kind === 'kick') {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(130, t);
            osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            osc.connect(g);
            g.connect(this.gain);
            osc.start(t);
            osc.stop(t + 0.18);
            return;
        }
        const noise = Sound.noiseBuffer();
        if (!noise) return;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = kind === 'hat' ? 'highpass' : 'bandpass';
        f.frequency.value = kind === 'hat' ? 7000 : 1800;
        const g = ctx.createGain();
        const dur = kind === 'hat' ? 0.04 : 0.12;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f);
        f.connect(g);
        g.connect(this.gain);
        src.start(t, Math.random() * 0.3, dur + 0.02);
    },

    _playStep(step, t, stepDur) {
        const s = this._song;
        const bar = Math.floor(step / 8) % s.chords.length;
        const pos = step % 8;
        const [deg, minor] = s.chords[bar];
        const base = s.root + deg;
        const chord = [0, minor ? 3 : 4, 7, 12];
        // Bass auf 1 und 5, im Rock-Muster auf jeder Achtel
        if (pos === 0 || pos === 4 || (s.drums === 'rock' && pos % 2 === 0)) {
            this._note('triangle', base - 12, t, stepDur * (pos % 4 === 0 ? 1.8 : 0.9), 0.55);
        }
        // Arpeggio
        const n = chord[s.arp[pos] % chord.length];
        this._note(s.lead, base + 12 + n, t, stepDur * 0.9, s.lead === 'sawtooth' ? 0.16 : 0.2, s.lead === 'triangle' ? 0 : 2200);
        // Schlagzeug
        if (s.drums === 'soft') {
            if (pos === 0) this._drum('kick', t, 0.45);
            if (pos % 2 === 1) this._drum('hat', t, 0.08);
        } else {
            if (pos === 0 || pos === 4 || (s.drums === 'rock' && pos === 6)) this._drum('kick', t, 0.6);
            if (pos === 2 || pos === 6) this._drum('snare', t, 0.22);
            this._drum('hat', t, pos % 2 ? 0.1 : 0.06);
        }
    },
};
