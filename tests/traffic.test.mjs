import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoadGraph, signalPhase, walkSignal, SIGNAL_CYCLE } from '../game/src/world/roads.js';
import { TrafficPool } from '../game/src/entities/traffic.js';
import { SeededRandom } from '../game/src/core/rng.js';
function game(seed = 'city') {
  return { rng: new SeededRandom(seed), world: { roads: createRoadGraph(seed) },
    player: { position: { x: 153, z: -105 }, vehicle: null }, loop: { time: 0 } };
}
test('lane and sidewalk graphs and signal offsets reproduce from a seed', () => {
  const a = createRoadGraph('salt'), b = createRoadGraph('salt'), c = createRoadGraph('steel');
  assert.deepEqual(a, b); assert.notDeepEqual(a.intersections, c.intersections);
  assert.equal(a.lanes.length, a.edges.length); assert.equal(a.sidewalk.nodes.length, a.nodes.length * 4);
  for (const lane of a.lanes) {
    assert.ok(lane.length > 0 && lane.next.length > 0);
    assert.ok(Math.abs(Math.hypot(lane.bx - lane.ax, lane.bz - lane.az) - lane.length) < 1e-10);
    assert.ok(lane.next.every(id => a.lanes[id].from === lane.to));
  }
  for (const edge of a.sidewalk.edges) assert.ok(edge.length > 0 && a.sidewalk.nodes[edge.to]);
});
test('green, amber, all-red and walk phases are exclusive and periodic per approach', () => {
  const graph = createRoadGraph(42);
  for (let time = 0; time < 128; time += .5) for (const node of graph.nodes) {
    const ns = signalPhase(graph, node.id, 'north', time), ew = signalPhase(graph, node.id, 'east', time);
    assert.equal(ns, signalPhase(graph, node.id, 'south', time));
    assert.equal(ew, signalPhase(graph, node.id, 'west', time));
    assert.equal(ns, signalPhase(graph, node.id, 'north', time + SIGNAL_CYCLE));
    assert.ok(ns === 'red' || ew === 'red');
    if (walkSignal(graph, node.id, time)) assert.ok(ns === 'red' && ew === 'red');
  }
  const origin = -graph.intersections[0].offset;
  assert.equal(signalPhase(graph, 0, 'north', origin), 'green');
  assert.equal(signalPhase(graph, 0, 'north', origin + 21), 'amber');
  assert.equal(signalPhase(graph, 0, 'east', origin + 30), 'green');
  assert.equal(walkSignal(graph, 0, origin + 50, 9), true);
  assert.equal(walkSignal(graph, 0, origin + 55, 9), false);
});
test('pooled traffic stops at red, queues, panics and replays without growth', () => {
  const run = () => {
    const g = game(), pool = new TrafficPool(g, 12, false); g.traffic = pool;
    for (let i = 0; i < 12; i++) pool.spawn(); assert.equal(pool.spawn(), null);
    const car = pool.slots[0], lane = g.world.roads.lanes[car.lane];
    car.progress = lane.length; car.speed = 8;
    g.loop.time = 51 - g.world.roads.intersections[lane.to].offset;
    pool.decide(car, .2, g); pool.update(1 / 60);
    assert.equal(car.turning, false); assert.equal(car.speed, 0);
    const lead = pool.slots[1]; lead.lane = car.lane; lead.progress = lane.length - 15;
    car.progress = lead.progress - car.length - 2.5; car.speed = 10; car.targetSpeed = 10;
    lead.speed = lead.targetSpeed = 0; pool.update(1 / 60);
    assert.ok(car.progress <= lead.progress - car.length - 2.5 + 1e-8);
    g.player.position.x = car.position.x; g.player.position.z = car.position.z; g.wanted = { level: 2 };
    pool.decide(car, 5, g); assert.equal(car.panic, true); assert.ok(pool.honks > 0);
    for (let i = 0; i < 600; i++) {
      g.loop.time += 1 / 60;
      for (const agent of pool.slots) pool.decide(agent, 1 / 60, g);
      pool.update(1 / 60);
    }
    assert.equal(pool.slots.length, 12); assert.equal(pool.highWater, 12);
    return pool.slots.map(agent => [agent.lane, agent.progress, agent.position.x, agent.position.z]);
  };
  assert.deepEqual(run(), run());
});
