import { clamp, damping } from '../core/math.js';
export function orientedBoxOverlap(a, b) {
  const axes = [
    { x: Math.cos(a.heading), z: -Math.sin(a.heading) }, { x: Math.sin(a.heading), z: Math.cos(a.heading) },
    { x: Math.cos(b.heading), z: -Math.sin(b.heading) }, { x: Math.sin(b.heading), z: Math.cos(b.heading) },
  ];
  const delta = { x: a.x - b.x, z: a.z - b.z };
  let penetration = Infinity, normal = null;
  const radius = (box, axis) => Math.abs(axis.x * Math.cos(box.heading) - axis.z * Math.sin(box.heading)) * box.width / 2 +
    Math.abs(axis.x * Math.sin(box.heading) + axis.z * Math.cos(box.heading)) * box.length / 2;
  for (const axis of axes) {
    const distance = delta.x * axis.x + delta.z * axis.z;
    const overlap = radius(a, axis) + radius(b, axis) - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < penetration) { penetration = overlap; normal = { x: axis.x * (distance >= 0 ? 1 : -1), z: axis.z * (distance >= 0 ? 1 : -1) }; }
  }
  return { penetration, normal };
}
export function updateArcadeDrivetrain(car, controls, dt) {
  const throttle = clamp(controls.throttle || 0, -1, 1), braking = controls.brake || 0;
  const steerTarget = clamp(controls.steer || 0, -1, 1);
  car.steer += (steerTarget - car.steer) * damping(7.5, dt);
  const forward = { x: Math.sin(car.heading), z: Math.cos(car.heading) }, right = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  let speed = car.velocity.x * forward.x + car.velocity.z * forward.z;
  let lateral = car.velocity.x * right.x + car.velocity.z * right.z;
  const engine = car.spec.power * (1 - .6 * clamp(Math.abs(speed) / car.spec.topSpeed, 0, 1));
  const acceleration = throttle * engine - speed * .055 - speed * Math.abs(speed) * .0014;
  speed += acceleration * dt;
  if (braking) speed *= Math.exp(-braking * 6 * dt);
  if (!throttle && Math.abs(speed) < .12) speed = 0;
  speed = clamp(speed, -12, car.spec.topSpeed);
  const handbrake = !!controls.handbrake, grip = handbrake ? 1.8 : 8.5;
  const turnRate = car.steer * (car.spec.length < 3 ? .82 : .56) * speed / (4 + Math.abs(speed) * .45);
  car.heading += turnRate * dt;
  lateral += turnRate * speed * dt * (handbrake ? 1.7 : .3);
  lateral *= Math.exp(-grip * dt);
  car.velocity.x = Math.sin(car.heading) * speed + Math.cos(car.heading) * lateral;
  car.velocity.z = Math.cos(car.heading) * speed - Math.sin(car.heading) * lateral;
  car.speed = speed; car.throttle = throttle; car.braking = braking; car.handbrake = handbrake;
  car.gear = speed < -.5 ? -1 : Math.max(1, Math.min(6, Math.floor(Math.abs(speed) / 9) + 1));
  car.rpm = 850 + Math.abs(throttle) * 1500 + ((Math.abs(speed) % 9) / 9) * 4200;
  car.slip = Math.abs(lateral);
  car.roll += (-car.steer * Math.abs(speed) * .0025 - car.roll) * damping(5, dt);
  car.pitch += (clamp(-acceleration * .008 + braking * .07, -.08, .08) - car.pitch) * damping(5, dt);
  return { dx: car.velocity.x * dt, dz: car.velocity.z * dt };
}
export function resolveVehicleWorld(car, collision, dx, dz) {
  car.position.x += dx; car.position.z += dz;
  let impact = 0;
  for (let iteration = 0; iteration < 2; iteration++) {
    for (const box of collision.query(car.position.x, car.position.z, car.length)) {
      if (car.position.y + car.spec.height < box.min.y || car.position.y > box.max.y) continue;
      const overlap = orientedBoxOverlap({ x: car.position.x, z: car.position.z, heading: car.heading, width: car.spec.width, length: car.length },
        { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, heading: 0, width: box.max.x - box.min.x, length: box.max.z - box.min.z });
      if (!overlap) continue;
      car.position.x += overlap.normal.x * (overlap.penetration + .015);
      car.position.z += overlap.normal.z * (overlap.penetration + .015);
      const velocity = car.velocity.x * overlap.normal.x + car.velocity.z * overlap.normal.z;
      if (velocity < 0) {
        impact = Math.max(impact, -velocity);
        car.velocity.x -= overlap.normal.x * velocity * 1.15; car.velocity.z -= overlap.normal.z * velocity * 1.15;
      }
    }
  }
  if (car.position.x < -730 || car.position.x > 235) car.velocity.x = 0;
  if (Math.abs(car.position.z) > 730) car.velocity.z = 0;
  car.position.x = clamp(car.position.x, -730, 235); car.position.z = clamp(car.position.z, -730, 730);
  car.speed = car.velocity.x * Math.sin(car.heading) + car.velocity.z * Math.cos(car.heading);
  return impact;
}
