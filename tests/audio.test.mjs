import test from 'node:test';
import assert from 'node:assert/strict';
import { engineFrequency, SynthesizedEngineAudio } from '../game/src/systems/engine-audio.js';
import { SeededRandom } from '../game/src/core/rng.js';
function mockContext() {
  const param = () => ({ value: 0, events: 0, setTargetAtTime(value) { this.value = value; this.events++; },
    setValueAtTime(value) { this.value = value; }, cancelScheduledValues() {},
    linearRampToValueAtTime(value) { this.peak = value; }, exponentialRampToValueAtTime(value) { this.value = value; } });
  const ctx = { sampleRate: 100, currentTime: 1, state: 'suspended', destination: {}, nodes: 0,
    async resume() { this.state = 'running'; }, createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; } };
  const node = () => { ctx.nodes++; return { gain: param(), frequency: param(), Q: param(), connect() {}, start() {} }; };
  ctx.createGain = ctx.createOscillator = ctx.createBiquadFilter = ctx.createBufferSource = node;
  return ctx;
}
function game(noaudio = false) {
  return { params: new URLSearchParams(noaudio ? 'noaudio' : ''), settings: { volume: .5, engineVolume: .65 },
    rng: new SeededRandom(1), player: { vehicle: { rpm: 900, throttle: 1, slip: 0 }, velocity: { x: 4, z: 0 }, grounded: true } };
}
test('engine fundamental tracks RPM with bounded frequency', () => {
  assert.equal(engineFrequency(900), 30); assert.equal(engineFrequency(4500), 150);
  assert.equal(engineFrequency(99999), 250); assert.ok(Number.isFinite(engineFrequency(NaN)));
});
test('gesture activation reuses voices; RPM, volume, squeal and pause control real audio params', async () => {
  const g = game(), ctx = mockContext(), audio = new SynthesizedEngineAudio(g, () => ctx);
  assert.equal(audio.started, false); assert.equal(ctx.nodes, 0);
  assert.equal(await audio.start(), true); const nodes = ctx.nodes;
  g.player.vehicle.rpm = 4500; g.player.vehicle.slip = 5; audio.update();
  assert.equal(audio.oscillators[0].voice.frequency.value, 150);
  assert.equal(audio.oscillators[2].voice.frequency.value, 450); assert.ok(audio.squealGain.gain.value > 0);
  g.settings.volume = .2; g.settings.engineVolume = 0; audio.update();
  assert.equal(audio.master.gain.value, .2); assert.equal(audio.engineGain.gain.value, 0);
  audio.setPaused(true); assert.equal(audio.worldGain.gain.value, 0);
  audio.blip(); assert.equal(audio.blips, 1); assert.equal(audio.uiGain.gain.peak, .12);
  audio.setPaused(false); audio.impact(12); assert.equal(audio.impacts, 1); assert.ok(Math.abs(audio.impactGain.gain.peak - .144) < 1e-12);
  audio.setPaused(false); g.player.vehicle = null;
  for (let i = 0; i < 60; i++) audio.update(1 / 60);
  assert.equal(audio.footsteps, 2); assert.equal(audio.engineGain.gain.value, 0);
  await audio.start(); assert.equal(ctx.nodes, nodes);
});
test('noaudio creates no context and unsupported audio fails quietly', async () => {
  let contexts = 0;
  const audio = new SynthesizedEngineAudio(game(true), () => { contexts++; return mockContext(); });
  assert.equal(await audio.start(), false); audio.update(); audio.blip(); assert.equal(contexts, 0);
  assert.equal(await new SynthesizedEngineAudio(game(), () => { throw Error('unavailable'); }).start(), false);
});
