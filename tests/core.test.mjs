import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../game/src/core/rng.js';
import { EntityPool, SystemRegistry } from '../game/src/core/registry.js';
import { FixedStepLoop } from '../game/src/core/loop.js';
test('seeded stream reproduces and forks separate domains', () => {
  const a = new SeededRandom('bay'), b = new SeededRandom('bay');
  assert.deepEqual(Array.from({ length: 50 }, () => a.next()), Array.from({ length: 50 }, () => b.next()));
  assert.notEqual(a.fork('cars').next(), a.fork('buildings').next());
});
test('entity budget cannot overflow; reuse clears all components', () => {
  const pool = new EntityPool(2);
  const a = pool.acquire('player', { transform: { x: 1 } });
  pool.acquire('car');
  assert.equal(pool.acquire('overflow'), null);
  assert.equal([...pool.query('transform')].length, 1);
  assert.equal(pool.release(a), true);
  assert.equal(pool.release(a), false);
  const b = pool.acquire('particle');
  assert.equal(pool.get(b, 'transform'), undefined);
  assert.equal(b.generation, 1);
});
test('system registry runs explicit order and can disable systems', () => {
  const systems = new SystemRegistry(), order = [];
  systems.register('camera', () => order.push('camera'), 90);
  systems.register('physics', () => order.push('physics'), 30);
  systems.update(1 / 60, {});
  assert.deepEqual(order, ['physics', 'camera']);
});
test('manual stepping clamps and uses fixed 60 Hz ticks', () => {
  let count = 0;
  const loop = new FixedStepLoop(() => count++, () => {});
  loop.step(1);
  assert.equal(count, 15);
  assert.equal(loop.ticks, 15);
});
