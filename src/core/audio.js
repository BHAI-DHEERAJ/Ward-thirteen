/**
 * Every sound in Ward Thirteen is synthesised at runtime with the WebAudio API:
 * filtered noise for wind, footsteps and rain-like hiss, oscillators for
 * fluorescent hum and elevator motors, shaped bursts for doors and impacts.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.volume = 0.8;
    this.inside = false;
    this.powered = false;
    this.entityNear = 0;
    this.nodes = {};
    this.timers = [];
    this._heartTimer = 0;
    this._dripTimer = 2 + Math.random() * 4;
    this._creakTimer = 8 + Math.random() * 14;
    this._footToggle = false;
  }

  init() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.started = true;
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 3.2;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.32;
    this.master.connect(this.compressor).connect(ctx.destination);

    this.ambient = ctx.createGain();
    this.ambient.gain.value = 0;
    this.ambient.connect(this.master);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    this.voice = ctx.createGain();
    this.voice.gain.value = 0.75;
    this.voice.connect(this.master);

    this.noise = this._noiseBuffer(2.5, 'white');
    this.pink = this._noiseBuffer(3.5, 'pink');

    this._startWind();
    this._startRoomTone();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  _noiseBuffer(seconds, type = 'white') {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'pink') {
        last = 0.98 * last + white * 0.02;
        data[i] = last * 4.2;
      } else if (type === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  _loop(buffer, gainVal, filterType, freq, q = 0.7) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = gainVal;
    src.connect(filter).connect(gain).connect(this.ambient);
    src.start();
    return { src, filter, gain };
  }

  _startWind() {
    const wind = this._loop(this.pink, 0.0, 'lowpass', 520, 0.4);
    // slow gust LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(wind.filter.frequency);
    lfo.start();
    this.nodes.wind = wind;
    this.nodes.windLfo = lfo;

    // a higher, thinner whistle layer
    const whistle = this._loop(this.pink, 0.0, 'bandpass', 1400, 6);
    this.nodes.whistle = whistle;

    // crickets: short high chirps, outdoors only
    const cricket = this.ctx.createOscillator();
    cricket.type = 'triangle';
    cricket.frequency.value = 4200;
    const cricketGain = this.ctx.createGain();
    cricketGain.gain.value = 0;
    const cricketLfo = this.ctx.createOscillator();
    cricketLfo.frequency.value = 7.5;
    const cricketLfoGain = this.ctx.createGain();
    cricketLfoGain.gain.value = 0.012;
    cricketLfo.connect(cricketLfoGain).connect(cricketGain.gain);
    cricket.connect(cricketGain).connect(this.ambient);
    cricket.start();
    cricketLfo.start();
    this.nodes.cricket = { osc: cricket, gain: cricketGain };
  }

  _startRoomTone() {
    // ventilation / deep building tone
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 46;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    osc.connect(g).connect(this.ambient);
    osc.start();
    this.nodes.tone = { osc, gain: g };

    const humOsc = this.ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 100;
    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 320;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0;
    humOsc.connect(humFilter).connect(humGain).connect(this.ambient);
    humOsc.start();
    this.nodes.hum = { osc: humOsc, gain: humGain, filter: humFilter };

    // air / ventilation noise
    const air = this._loop(this.pink, 0, 'bandpass', 380, 1.1);
    this.nodes.air = air;

    const drips = this.ctx.createGain();
    drips.gain.value = 0;
    drips.connect(this.ambient);
    this.nodes.drips = drips;
  }

  setEnvironment({ inside, powered }) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    if (inside !== this.inside) {
      this.inside = inside;
      this.nodes.wind.gain.gain.setTargetAtTime(inside ? 0.055 : 0.16, t, 1.4);
      this.nodes.whistle.gain.gain.setTargetAtTime(inside ? 0.0 : 0.05, t, 1.6);
      this.nodes.cricket.gain.gain.setTargetAtTime(inside ? 0.0004 : 0.02, t, 2.0);
      this.nodes.air.gain.gain.setTargetAtTime(inside ? 0.09 : 0.035, t, 1.4);
      this.nodes.tone.gain.gain.setTargetAtTime(inside ? 0.055 : 0.028, t, 1.5);
      this.ambient.gain.setTargetAtTime(1, t, 0.8);
    }
    if (powered !== this.powered) {
      this.powered = powered;
      this.nodes.hum.gain.gain.setTargetAtTime(powered ? 0.03 : 0.006, t, 1.5);
      this.nodes.drips.gain.gain.setTargetAtTime(powered ? 0.5 : 0.16, t, 1.6);
    }
  }

  // ------------------------------------------------------------------ one-shots
  _play(buffer, { gain = 0.3, filter = 'lowpass', freq = 1200, q = 1, rate = 1, duration = 1, pan = 0, attack = 0.004, dest } = {}) {
    if (!this.started) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    let out = g;
    if (pan !== 0) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      out = p;
    }
    src.connect(f).connect(g);
    out.connect(dest || this.sfx);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  _tone(freq, { gain = 0.1, type = 'sine', duration = 0.3, pan = 0, slideTo = null, dest } = {}) {
    if (!this.started) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    let out = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    osc.connect(g);
    out.connect(dest || this.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  footstep(surface = 'linoleum', sprinting = false) {
    if (!this.started) return;
    this._footToggle = !this._footToggle;
    const base = {
      linoleum: { freq: 760, q: 1.4, gain: 0.16, rate: 1.05, dur: 0.12 },
      tile: { freq: 1150, q: 2.6, gain: 0.14, rate: 1.2, dur: 0.1 },
      concrete: { freq: 420, q: 0.8, gain: 0.18, rate: 0.9, dur: 0.14 },
      carpet: { freq: 320, q: 0.6, gain: 0.10, rate: 0.85, dur: 0.15 },
      stairs: { freq: 340, q: 1.6, gain: 0.2, rate: 0.95, dur: 0.16 },
    }[surface] || { freq: 760, q: 1.4, gain: 0.14, rate: 1, dur: 0.12 };
    this._play(this.noise, {
      gain: base.gain * (sprinting ? 1.35 : 1),
      filter: 'bandpass', freq: base.freq * (0.94 + Math.random() * 0.12),
      q: base.q, rate: base.rate * (0.9 + Math.random() * 0.2),
      duration: base.dur,
    });
    // low thump
    this._tone(70 + Math.random() * 12, { gain: 0.05, type: 'sine', duration: 0.09 });
    if (sprinting) this.breath();
  }

  breath() {
    if (!this.started) return;
    this._play(this.pink, { gain: 0.1, filter: 'bandpass', freq: 700, q: 0.9, duration: 0.42, attack: 0.08 });
  }

  click() { this._tone(1800, { gain: 0.06, type: 'square', duration: 0.035 }); }
  uiSelect() { this._tone(880, { gain: 0.035, type: 'sine', duration: 0.08 }); }
  flashlightClick() { this._tone(1400, { gain: 0.05, type: 'square', duration: 0.03, slideTo: 700 }); }

  pickup() {
    this._play(this.noise, { gain: 0.1, filter: 'highpass', freq: 1800, duration: 0.16 });
    this._tone(520, { gain: 0.04, type: 'sine', duration: 0.09, slideTo: 700 });
  }

  paper() {
    this._play(this.noise, { gain: 0.12, filter: 'highpass', freq: 2600, duration: 0.3, attack: 0.02 });
  }

  locked() {
    this._play(this.noise, { gain: 0.16, filter: 'bandpass', freq: 2400, q: 3, duration: 0.14 });
    this._tone(180, { gain: 0.09, type: 'square', duration: 0.09 });
  }

  unlock() {
    this._play(this.noise, { gain: 0.12, filter: 'bandpass', freq: 3200, q: 4, duration: 0.1 });
    this._tone(900, { gain: 0.05, type: 'triangle', duration: 0.14, slideTo: 1400 });
  }

  doorOpen(pan = 0) {
    this._play(this.pink, { gain: 0.22, filter: 'bandpass', freq: 620, q: 2.2, duration: 1.15, attack: 0.12, pan });
    this._tone(120, { gain: 0.05, type: 'sawtooth', duration: 0.9, slideTo: 80, pan });
  }

  doorClose(pan = 0) {
    this._play(this.pink, { gain: 0.26, filter: 'lowpass', freq: 480, duration: 0.45, attack: 0.02, pan });
    this._tone(90, { gain: 0.1, type: 'sine', duration: 0.3, pan });
  }

  search() {
    this._play(this.noise, { gain: 0.1, filter: 'bandpass', freq: 900, q: 1.2, duration: 0.4, attack: 0.05 });
    setTimeout(() => this._play(this.noise, { gain: 0.08, filter: 'bandpass', freq: 1600, q: 2, duration: 0.3 }), 180);
  }

  rumble() {
    this._play(this.pink, { gain: 0.25, filter: 'lowpass', freq: 150, duration: 2.4, attack: 0.8 });
  }

  thunder(distance = 1) {
    if (!this.started) return;
    const g = 0.35 / (1 + distance);
    this._play(this.pink, { gain: g, filter: 'lowpass', freq: 220, duration: 2.6, attack: 0.12 });
    this._play(this.pink, { gain: g * 0.6, filter: 'lowpass', freq: 90, duration: 3.4, attack: 0.4 });
  }

  drip(pan = 0) {
    this._tone(1200 + Math.random() * 700, { gain: 0.035, type: 'sine', duration: 0.08, pan, slideTo: 400 });
  }

  creak(pan = 0.3) {
    this._play(this.pink, { gain: 0.08, filter: 'bandpass', freq: 380, q: 5, duration: 1.4, attack: 0.2, pan });
  }

  metalImpact(pan = 0) {
    this._play(this.noise, { gain: 0.14, filter: 'bandpass', freq: 2200, q: 6, duration: 0.5, pan });
    this._tone(320, { gain: 0.04, type: 'triangle', duration: 0.7, slideTo: 200, pan });
  }

  electrical() {
    this._play(this.noise, { gain: 0.07, filter: 'highpass', freq: 3000, duration: 0.3 });
    this._tone(120, { gain: 0.03, type: 'sawtooth', duration: 0.2 });
  }

  elevatorBell() {
    this._tone(880, { gain: 0.08, type: 'sine', duration: 0.5 });
    setTimeout(() => this._tone(660, { gain: 0.06, type: 'sine', duration: 0.7 }), 260);
  }

  elevatorMotor(on) {
    if (!this.started) return;
    if (!this.motor) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 42;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 180;
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(f).connect(g).connect(this.sfx);
      osc.start();
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = this.pink;
      noiseSrc.loop = true;
      const ng = ctx.createGain();
      ng.gain.value = 0;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 340;
      noiseSrc.connect(nf).connect(ng).connect(this.sfx);
      noiseSrc.start();
      this.motor = { osc, gain: g, noiseGain: ng };
    }
    const t = this.ctx.currentTime;
    this.motor.gain.gain.setTargetAtTime(on ? 0.1 : 0, t, 0.2);
    this.motor.noiseGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.3);
  }

  heartbeat(intensity = 1) {
    this._tone(46, { gain: 0.09 * intensity, type: 'sine', duration: 0.16 });
    setTimeout(() => this._tone(40, { gain: 0.06 * intensity, type: 'sine', duration: 0.2 }), 190);
  }

  whisper(pan = 0) {
    if (!this.started) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pink;
    src.playbackRate.value = 0.8;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 1.8;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(f).connect(g).connect(p).connect(this.voice);
    src.start(t);
    src.stop(t + 1.2);
  }

  entityStep(pan = 0, distance = 1) {
    const g = Math.max(0.05, 0.4 / (1 + distance * 0.5));
    this._play(this.pink, { gain: g, filter: 'lowpass', freq: 300, duration: 0.16, pan });
    this._tone(54, { gain: g * 0.5, type: 'sine', duration: 0.2, pan });
  }

  entityBreath(pan = 0, distance = 1) {
    const g = Math.max(0.03, 0.2 / (1 + distance * 0.6));
    this._play(this.pink, { gain: g, filter: 'bandpass', freq: 480, q: 1.2, duration: 0.9, attack: 0.2, pan });
  }

  sting() {
    this._tone(1200, { gain: 0.12, type: 'sawtooth', duration: 0.7, slideTo: 220 });
    this._play(this.noise, { gain: 0.18, filter: 'highpass', freq: 2400, duration: 0.5 });
  }

  radioStatic(duration = 1.2) {
    this._play(this.noise, { gain: 0.08, filter: 'bandpass', freq: 1800, q: 0.8, duration, attack: 0.05 });
  }

  missionComplete() {
    this._tone(220, { gain: 0.05, type: 'sine', duration: 1.2 });
    setTimeout(() => this._tone(330, { gain: 0.04, type: 'sine', duration: 1.4 }), 260);
    setTimeout(() => this._tone(440, { gain: 0.03, type: 'sine', duration: 1.8 }), 520);
  }

  generatorStart() {
    this._tone(60, { gain: 0.15, type: 'sawtooth', duration: 2.2, slideTo: 42 });
    this._play(this.pink, { gain: 0.2, filter: 'lowpass', freq: 260, duration: 2.4, attack: 0.3 });
  }

  pickupDenied() {
    this._tone(200, { gain: 0.06, type: 'square', duration: 0.12, slideTo: 140 });
  }

  // ------------------------------------------------------------------ ambience
  update(dt, { entityDistance = 99, moving = false }) {
    if (!this.started) return;
    this._dripTimer -= dt;
    if (this._dripTimer <= 0 && this.inside) {
      this._dripTimer = 2.5 + Math.random() * 7;
      this.drip(Math.random() * 1.6 - 0.8);
    }
    this._creakTimer -= dt;
    if (this._creakTimer <= 0 && this.inside) {
      this._creakTimer = 9 + Math.random() * 20;
      this.creak(Math.random() * 1.4 - 0.7);
    }
    this.entityNear = entityDistance;
    this._heartTimer -= dt;
    if (entityDistance < 16) {
      const rate = 0.55 + Math.min(0.5, (16 - entityDistance) / 32);
      if (this._heartTimer <= 0) {
        this._heartTimer = rate;
        this.heartbeat(Math.min(1, (16 - entityDistance) / 12 + 0.25));
      }
    }
    if (moving) this.ambient.gain.setTargetAtTime(1, this.ctx.currentTime, 0.5);
  }
}
