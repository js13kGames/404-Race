class Synth {
    constructor(isMuted, onMute) {
        this.tones = new Array(120);

        for (let i = 0; i < 120; i++) {
            this.tones[i] = Math.pow(2, (i - 49) / 12) * 440;
        }

        this.isMuted = isMuted;
        this.ctx = null;
        this.master = null;
        this.osc = null;

        this.stop = this.stop.bind(this);
        this.onMute = onMute;
    }

    init() {
        if (this.ctx) return;

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        const master = this.ctx.createGain();
        master.connect(this.ctx.destination);
        master.gain.value = 1.0;
        this.master = master;

        const osc = this.ctx.createOscillator();
        osc.connect(this.master);

        const sinTerms = new Float32Array([0, 0, 1, 0, 1]);
        const cosTerms = new Float32Array(sinTerms.length);
        osc.setPeriodicWave(
            this.ctx.createPeriodicWave(cosTerms, sinTerms)
        );

        osc.frequency.value = 0;
        osc.start();
        this.osc = osc;
    }

    play(n, d, volume) {
        if (this.isMuted || this.timeout) return;
        // Does not work on FF: exponentialRampToValueAtTime
        // this.osc.frequency.exponentialRampToValueAtTime(this.tones[n], (this.ctx.currentTime || 1) + 0.1);
        this.master.gain.setValueAtTime(volume, this.ctx.currentTime + 0.015);
        this.osc.frequency.setValueAtTime(this.tones[n], this.ctx.currentTime + 0.015);
        this.timeout = setTimeout(this.stop, d);
    }

    stop() {
        this.osc.frequency.setValueAtTime(0.01, this.ctx.currentTime + 0.05);
        setTimeout(() => this.timeout = null, 50);
    }

    toggle() {
        this.onMute(this.isMuted = !this.isMuted);
    }
}
