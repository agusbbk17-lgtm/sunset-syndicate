import test from 'node:test';
import assert from 'node:assert/strict';
import { updateArcadeDrivetrain, orientedBoxOverlap } from '../game/src/systems/vehicle-physics.js';
import { VEHICLE_TYPES } from '../game/src/data/vehicles.js';
function createCar() { return { spec: VEHICLE_TYPES.sports, heading: 0, velocity: { x: 0, z: 0 }, steer: 0, roll: 0, pitch: 0 }; }
test('sports drivetrain covers 300 m and gears and RPM follow acceleration', () => {
  const car = createCar(); let distance = 0;
  for (let i = 0; i < 1200; i++) distance += updateArcadeDrivetrain(car, { throttle: 1 }, 1 / 60).dz;
  assert.ok(distance > 300); assert.ok(car.gear > 1); assert.ok(car.rpm > 850);
  const speed = car.speed;
  for (let i = 0; i < 120; i++) updateArcadeDrivetrain(car, { brake: 1 }, 1 / 60);
  assert.ok(car.speed < speed * .01);
});
test('oriented SAT detects overlap and separates rotated bodies', () => {
  const a = { x: 0, z: 0, width: 2, length: 4, heading: Math.PI / 4 };
  assert.ok(orientedBoxOverlap(a, { ...a, x: 1, heading: 0 }));
  assert.equal(orientedBoxOverlap(a, { ...a, x: 10 }), null);
});
test('eight original procedural vehicle specifications have finite dimensions', () => {
  assert.equal(Object.keys(VEHICLE_TYPES).length, 8);
  for (const spec of Object.values(VEHICLE_TYPES)) assert.ok(spec.length > spec.width && spec.topSpeed > 30);
});
