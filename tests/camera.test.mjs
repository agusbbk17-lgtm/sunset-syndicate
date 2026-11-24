import test from 'node:test';
import assert from 'node:assert/strict';
import { damping } from '../game/src/core/math.js';
import { castCameraArm, characterOpacity } from '../game/src/camera/arm-collision.js';
test('exponential damping converges identically at 60 and 144 Hz', () => {
  function integrate(hz) { let pose = 0; for (let i = 0; i < hz * 3; i++) pose += (10 - pose) * damping(8.3, 1 / hz); return pose; }
  assert.ok(Math.abs(integrate(60) - integrate(144)) < 1e-12);
});
test('all three spring arms pull in before a wall with sphere clearance', () => {
  const wall = { min: { x: -4, y: 0, z: -2 }, max: { x: 4, y: 8, z: -1.5 } };
  for (const distance of [1.8, 2.8, 4.2]) {
    const hit = castCameraArm({ x: 0, y: 1.7, z: 0 }, { x: .6, y: 2, z: -distance }, [wall]);
    assert.ok(hit.hits > 0); assert.ok(hit.z > -1.28); assert.ok(hit.fraction < 1);
  }
});
test('character fully visible at .6 m, fades below, and disappears at .2 m', () => {
  assert.equal(characterOpacity(.6), 1); assert.ok(characterOpacity(.4) < 1); assert.equal(characterOpacity(.2), 0);
});
