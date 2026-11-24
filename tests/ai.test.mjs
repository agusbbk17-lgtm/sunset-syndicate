import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentScheduler } from '../game/src/systems/ai.js';
test('rotating AI window bounds work and services every agent deterministically', () => {
  const run = () => {
    const scheduler = new AgentScheduler(256, 16), counts = new Uint32Array(256);
    const owner = { decide(agent) { counts[agent.id]++; } };
    for (let i = 0; i < 256; i++) assert.equal(scheduler.register({ id: i, active: true }, owner), true);
    assert.equal(scheduler.register({}, owner), false);
    for (let i = 0; i < 60; i++) scheduler.update(1 / 60, {});
    assert.equal(scheduler.maxWork, 16); assert.ok(counts.every(value => value >= 3));
    return counts;
  };
  assert.deepEqual(run(), run());
});
