import { clamp } from '../core/math.js';
export const engineFrequency = rpm => clamp(Number(rpm) || 850, 600, 7500) / 30;
export class SynthesizedEngineAudio {
  constructor(game, contextFactory = null) {
    this.game = game; this.context = null; this.started = false; this.disabled = game.params.has('noaudio');
    this.factory = contextFactory; this.targetFrequency = engineFrequency(850); this.paused = false;
    this.stepClock = 0; this.blips = 0; this.footsteps = 0; this.honks = 0; this.impacts = 0; this.starting = null;
    if (typeof document !== 'undefined' && !this.disabled) {
      const gesture = () => { if (!this.started) void this.start(); };
      document.addEventListener('pointerdown', gesture); document.addEventListener('keydown', gesture);
      document.addEventListener('visibilitychange', () => this.update());
    }
  }
  gain(destination, value = 0) {
    const node = this.context.createGain(); node.gain.value = value; node.connect(destination); return node;
  }
  tone(type, frequency, destination) {
    const node = this.context.createOscillator(); node.type = type; node.frequency.value = frequency;
    node.connect(destination); node.start(); return node;
  }
  build() {
    const ctx = this.context;
    this.master = this.gain(ctx.destination, this.game.settings.volume);
    this.worldGain = this.gain(this.master, this.paused ? 0 : 1);
    this.engineGain = this.gain(this.worldGain);
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass';
    this.filter.frequency.value = 650; this.filter.Q.value = .8; this.filter.connect(this.engineGain);
    this.oscillators = [];
    for (let index = 0; index < 3; index++) {
      const harmonic = index + 1, gain = this.gain(this.filter, [.3, .14, .065][index]);
      this.oscillators.push({ voice: this.tone(index === 0 ? 'sawtooth' : 'triangle', this.targetFrequency * harmonic, gain), harmonic });
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = buffer.getChannelData(0), rng = this.game.rng.fork('engine-noise');
    for (let i = 0; i < samples.length; i++) samples[i] = rng.range(-1, 1);
    this.noise = ctx.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true;
    this.noise.connect(this.gain(this.filter, .009));
    this.ambienceFilter = ctx.createBiquadFilter(); this.ambienceFilter.type = 'lowpass'; this.ambienceFilter.frequency.value = 280;
    this.noise.connect(this.ambienceFilter); this.ambienceFilter.connect(this.gain(this.worldGain, .045)); this.noise.start();
    this.squealGain = this.gain(this.worldGain); this.squeal = this.tone('triangle', 1150, this.squealGain);
    this.stepGain = this.gain(this.worldGain); this.stepVoice = this.tone('triangle', 105, this.stepGain);
    this.uiGain = this.gain(this.master); this.uiVoice = this.tone('sine', 740, this.uiGain);
    this.hornGain = this.gain(this.worldGain); this.hornVoice = this.tone('square', 185, this.hornGain);
    this.impactGain = this.gain(this.worldGain); this.impactVoice = this.tone('sine', 65, this.impactGain);
  }
  async start() {
    if (this.disabled) return false;
    if (this.starting) return this.starting;
    this.starting = this.activate();
    const result = await this.starting; this.starting = null; return result;
  }
  async activate() {
    try {
      if (!this.context) {
        const AudioContext = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
        if (!this.factory && !AudioContext) return false;
        this.context = this.factory ? this.factory() : new AudioContext(); this.build();
      }
      await this.context.resume(); this.started = this.context.state === 'running'; this.update(0); return this.started;
    } catch { return false; }
  }
  pulse(gain, amplitude, duration) {
    const now = this.context.currentTime, param = gain.gain;
    param.cancelScheduledValues(now); param.setValueAtTime(0, now);
    param.linearRampToValueAtTime(amplitude, now + .008); param.exponentialRampToValueAtTime(.0001, now + duration);
  }
  blip() { if (!this.started || this.disabled) return; this.pulse(this.uiGain, .12, .11); this.blips++; }
  honk() { if (!this.started || this.paused) return; this.pulse(this.hornGain, .025, .35); this.honks++; }
  impact(speed) {
    if (!this.started || this.paused || speed <= 2) return;
    this.pulse(this.impactGain, Math.min(.25, speed * .012), .22); this.impacts++;
  }
  setPaused(paused) { this.paused = paused; this.update(0); }
  update(dt = 1 / 60) {
    const car = this.game.player.vehicle;
    this.targetFrequency = engineFrequency(car?.rpm || 850);
    if (!this.started || !this.context) return;
    const now = this.context.currentTime;
    for (let i = 0; i < this.oscillators.length; i++) {
      const oscillator = this.oscillators[i]; oscillator.voice.frequency.setTargetAtTime(this.targetFrequency * oscillator.harmonic, now, .045);
    }
    this.engineGain.gain.setTargetAtTime(car ? (.12 + Math.abs(car.throttle || 0) * .12) * this.game.settings.engineVolume : 0, now, .1);
    this.filter.frequency.setTargetAtTime(500 + (car?.rpm || 850) * .19, now, .1);
    if (dt > 0) for (const event of this.game.vehicles?.impactEvents || []) this.impact(event.speed);
    const slip = car ? Math.min(1, (car.slip || 0) / 5 + (car.handbrake ? Math.abs(car.speed) / 20 : 0)) : 0;
    this.squealGain.gain.setTargetAtTime(slip * .035 * this.game.settings.engineVolume, now, .045);
    this.master.gain.setTargetAtTime(this.game.settings.volume, now, .05);
    const hidden = typeof document !== 'undefined' && document.hidden;
    this.worldGain.gain.setTargetAtTime(this.paused || hidden ? 0 : 1, now, .08);
    if (hidden) this.master.gain.setTargetAtTime(0, now, .05);
    const player = this.game.player, speed = Math.hypot(player.velocity?.x || 0, player.velocity?.z || 0);
    if (!car && player.grounded && !this.paused && !hidden && speed > .3) {
      this.stepClock += dt * (player.sprint ? 3.5 : 2.2);
      if (this.stepClock >= 1) { this.stepClock %= 1; this.pulse(this.stepGain, .11, .09); this.footsteps++; }
    } else this.stepClock = 0;
  }
  get debug() { return { started: this.started, state: this.context?.state || 'off', frequency: this.targetFrequency,
    rpm: this.game.player.vehicle?.rpm || 850, gear: this.game.player.vehicle?.gear || 0,
    footsteps: this.footsteps, blips: this.blips, honks: this.honks, impacts: this.impacts }; }
}
