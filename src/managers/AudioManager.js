// Synthesized SFX using WebAudio API (no external audio files needed)
import { SaveManager } from './SaveManager.js';

class _AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.musicOsc = null;
    this.musicNodes = [];
    this._stretchOsc = null;   // sustained "rubber-band tension" tone while aiming
    this._stretchGain = null;
    this.settings = SaveManager.getSettings();
  }

  _ensureCtx() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.12;
      this.musicGain.connect(this.master);
    } catch (e) {
      // audio disabled
    }
  }

  resume() {
    this._ensureCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setSettings(s) {
    this.settings = { ...s };
    SaveManager.setSettings(this.settings);
    if (!this.settings.music) this.stopMusic();
    else if (this.settings.music && !this.musicOsc) this.startMusic();
  }

  // ---------------- SFX ----------------
  _tone({ freq = 440, type = 'sine', dur = 0.2, attack = 0.005, decay = 0.18, vol = 0.4, freqEnd = null }) {
    if (!this.settings.sfx) return;
    this._ensureCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + dur);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
  }

  playDrop() {
    this._tone({ freq: 180, type: 'triangle', dur: 0.12, decay: 0.12, vol: 0.25, freqEnd: 120 });
  }

  // Higher fruit level → higher pitch (do-re-mi feeling)
  playMerge(level) {
    if (!this.settings.sfx) return;
    // C major pentatonic feel: C D E G A C D E G A C
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const idx = Math.max(0, Math.min(scale.length - 1, level - 1));
    const f = scale[idx];

    this._tone({ freq: f, type: 'triangle', dur: 0.3, decay: 0.28, vol: 0.32 });
    // little harmonic sparkle
    setTimeout(() => this._tone({ freq: f * 1.5, type: 'sine', dur: 0.18, decay: 0.18, vol: 0.18 }), 35);

    // haptic
    if (this.settings.vibe && navigator.vibrate) {
      navigator.vibrate(Math.min(40 + level * 4, 90));
    }
  }

  playCombo(step) {
    if (!this.settings.sfx) return;
    const f = 440 + step * 80;
    this._tone({ freq: f, type: 'square', dur: 0.18, decay: 0.16, vol: 0.22, freqEnd: f * 1.6 });
  }

  playGameOver() {
    this._tone({ freq: 400, type: 'sawtooth', dur: 0.6, decay: 0.55, vol: 0.35, freqEnd: 80 });
    setTimeout(() => this._tone({ freq: 200, type: 'sawtooth', dur: 0.5, decay: 0.45, vol: 0.28, freqEnd: 60 }), 200);
  }

  playNewRecord() {
    if (!this.settings.sfx) return;
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => setTimeout(() => this._tone({ freq: f, type: 'triangle', dur: 0.18, decay: 0.16, vol: 0.32 }), i * 100));
  }

  playClick() {
    this._tone({ freq: 880, type: 'square', dur: 0.06, decay: 0.05, vol: 0.18 });
  }

  // soft thud on landing — pitch lower for bigger fruit, volume from impact (0..1)
  playThud(intensity = 0.5, level = 1) {
    if (!this.settings.sfx) return;
    const base = 150 - level * 7;
    this._tone({ freq: base, type: 'sine', dur: 0.1, decay: 0.1, vol: 0.06 + intensity * 0.14, freqEnd: base * 0.6 });
  }

  playLevelUp() {
    if (!this.settings.sfx) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      setTimeout(() => this._tone({ freq: f, type: 'triangle', dur: 0.2, decay: 0.18, vol: 0.3 }), i * 70)
    );
  }

  playCoin() {
    if (!this.settings.sfx) return;
    this._tone({ freq: 1200 + Math.random() * 300, type: 'square', dur: 0.07, decay: 0.06, vol: 0.12, freqEnd: 1800 });
  }

  playReward() {
    if (!this.settings.sfx) return;
    [659.25, 783.99, 987.77].forEach((f, i) =>
      setTimeout(() => this._tone({ freq: f, type: 'triangle', dur: 0.16, decay: 0.14, vol: 0.3 }), i * 80)
    );
  }

  playWoosh() {
    this._tone({ freq: 800, type: 'sine', dur: 0.18, decay: 0.16, vol: 0.2, freqEnd: 200 });
  }

  // ---------------- Slingshot ----------------
  // A sustained creak that rises in pitch/volume as the band is stretched.
  startStretch() {
    if (!this.settings.sfx) return;
    this._ensureCtx();
    if (!this.ctx || this._stretchOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 120;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    this._stretchOsc = osc;
    this._stretchGain = gain;
  }

  updateStretch(t) {
    if (!this._stretchOsc || !this.ctx) return;
    const tt = Math.max(0, Math.min(1, t));
    const now = this.ctx.currentTime;
    this._stretchOsc.frequency.setTargetAtTime(120 + tt * 380, now, 0.03);
    this._stretchGain.gain.setTargetAtTime(0.012 + tt * 0.06, now, 0.04);
  }

  stopStretch() {
    if (this._stretchOsc && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this._stretchGain.gain.setTargetAtTime(0.0001, now, 0.03);
        this._stretchOsc.stop(now + 0.12);
      } catch {}
    }
    this._stretchOsc = null;
    this._stretchGain = null;
  }

  // Springy "thwip" when the band is released — brighter/louder with power.
  playTwang(power = 0.6) {
    if (!this.settings.sfx) return;
    const p = Math.max(0, Math.min(1, power));
    this._tone({ freq: 240 + p * 260, type: 'triangle', dur: 0.2, decay: 0.18, vol: 0.16 + p * 0.2, freqEnd: 90 });
    setTimeout(() => this._tone({ freq: 680 + p * 520, type: 'sine', dur: 0.12, decay: 0.12, vol: 0.1 + p * 0.12, freqEnd: 200 }), 16);
  }

  // ---------------- MUSIC (very gentle ambient pad) ----------------
  startMusic() {
    if (!this.settings.music) return;
    this._ensureCtx();
    if (!this.ctx || this.musicOsc) return;

    // warm ambient pad: detuned root + octave + a soft perfect-fifth, through a
    // low-pass with a slow filter sweep and a gentle "breathing" volume LFO
    const root = 110;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const o3 = this.ctx.createOscillator(); // perfect fifth, quieter, for warmth
    o1.type = 'sine'; o2.type = 'sine'; o3.type = 'triangle';
    o1.frequency.value = root;
    o2.frequency.value = root * 1.005;
    o3.frequency.value = root * 1.5;

    const fifthGain = this.ctx.createGain();
    fifthGain.gain.value = 0.35;
    o3.connect(fifthGain);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 560;

    // slow filter sweep
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // breathing volume
    const breath = this.ctx.createOscillator();
    breath.frequency.value = 0.07;
    const breathGain = this.ctx.createGain();
    breathGain.gain.value = 0.035;
    breath.connect(breathGain);
    breathGain.connect(this.musicGain.gain);

    o1.connect(filter);
    o2.connect(filter);
    fifthGain.connect(filter);
    filter.connect(this.musicGain);

    o1.start(); o2.start(); o3.start(); lfo.start(); breath.start();
    this.musicOsc = o1;
    this.musicNodes = [o2, o3, fifthGain, lfo, lfoGain, breath, breathGain, filter];
  }

  stopMusic() {
    if (this.musicOsc) {
      try { this.musicOsc.stop(); } catch {}
      this.musicNodes.forEach(n => { try { n.stop && n.stop(); } catch {} });
      this.musicOsc = null;
      this.musicNodes = [];
    }
  }
}

export const AudioManager = new _AudioManager();
