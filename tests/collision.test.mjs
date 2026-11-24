import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldCollision } from '../game/src/world/collision.js';
test('spatial collider queries and circle sliding block walls', () => {
  const world = new WorldCollision();
  world.add({ x: 0, y: 0, z: 0 }, { x: 10, y: 12, z: 10 });
  assert.equal(world.query(5, 5).length, 1);
  const result = world.moveCircle({ x: -.5, y: .15, z: 5 }, .3, 1, .36);
  assert.ok(result.x <= -.36); assert.equal(result.z, 6); assert.equal(result.hit, true);
  assert.equal(world.inside({ x: 5, y: 3, z: 5 }), true);
  assert.equal(world.inside({ x: 5, y: 20, z: 5 }), false);
});
