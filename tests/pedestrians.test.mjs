import test from 'node:test';
import assert from 'node:assert/strict';
import { PedestrianPool } from '../game/src/entities/pedestrian.js';
import { createRoadGraph } from '../game/src/world/roads.js';
import { SeededRandom } from '../game/src/core/rng.js';
import { AgentScheduler } from '../game/src/systems/ai.js';
function setup(cap = 24) {
  const game = { rng: new SeededRandom('walkers'), world: { roads: createRoadGraph('walkers') },
    player: { position: { x: 153, z: -105 }, vehicle: null }, loop: { time: 0 }, ai: new AgentScheduler(256, 16) };
  const pool = new PedestrianPool(game, cap, false); game.pedestrians = pool; return { game, pool };
}
test('pedestrian pool never exceeds its cap and recycles the same objects', () => {
  const { pool } = setup(24), slots = pool.slots.slice();
  for (let cycle = 0; cycle < 100; cycle++) {
    for (let i = 0; i < 24; i++) assert.ok(pool.spawn());
    for (let i = 0; i < 50; i++) assert.equal(pool.spawn(), null);
    assert.equal(pool.count, 24); assert.equal(pool.highWater, 24);
    for (const agent of pool.slots) assert.equal(pool.release(agent), true);
    assert.equal(pool.release(slots[0]), false); assert.equal(pool.count, 0);
  }
  assert.equal(pool.slots.length, 24); assert.ok(slots.every((agent, i) => agent === pool.slots[i]));
});
test('walkers wait for walk, flee from shots and closing cars, topple and recover', () => {
  const { game, pool } = setup(4), agent = pool.spawn(), sidewalk = pool.graph;
  const crossing = sidewalk.edges.find(edge => edge.crossing >= 0), node = sidewalk.nodes[crossing.from];
  agent.node = crossing.from; agent.edge = crossing.id; agent.progress = 0;
  agent.position.x = node.x; agent.position.z = node.z;
  const start = -game.world.roads.intersections[crossing.crossing].offset;
  game.loop.time = start + 5; pool.update(1 / 60); assert.equal(agent.speed, 0); assert.equal(agent.state, 'wait');
  game.loop.time = start + 50; pool.update(1 / 60); assert.ok(agent.progress > 0);
  game.ai.gunshot(agent.position.x, agent.position.z, game.loop.time); pool.decide(agent, .25, game);
  assert.equal(agent.state, 'flee'); assert.equal(game.ai.shots.length, 16);
  agent.state = 'wander';
  const car = { position: { x: agent.position.x, z: agent.position.z - 6 }, heading: 0, speed: 8,
    velocity: { x: 0, z: 8 }, length: 4.7, spec: { width: 1.9 } };
  pool.checkThreat(agent, car); assert.equal(agent.state, 'flee');
  car.position.z = agent.position.z; assert.equal(pool.strike(agent, car), true); assert.equal(agent.state, 'toppled');
  for (let i = 0; i < 370; i++) { game.loop.time += 1 / 60; pool.update(1 / 60); }
  assert.notEqual(agent.state, 'toppled'); assert.equal(pool.count, 1); assert.equal(pool.topples, 1);
});
test('crowd kinematics, seeded decisions and saved shot poses replay', () => {
  const run = () => {
    const { game, pool } = setup(64);
    for (let i = 0; i < 64; i++) pool.spawn(); pool.capture();
    const advance = () => {
      for (let i = 0; i < 600; i++) { game.ai.update(1 / 60, game); pool.update(1 / 60); game.loop.time += 1 / 60; }
      return pool.slots.map(agent => [agent.position.x, agent.position.z, agent.state, agent.rng.state]);
    };
    const first = advance(); pool.reset(); game.ai.reset(); game.loop.time = 0;
    assert.deepEqual(advance(), first); assert.ok(game.ai.maxWork <= 16); return first;
  };
  assert.deepEqual(run(), run());
});
