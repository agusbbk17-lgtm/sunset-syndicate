// Conservative sphere sweep against expanded world AABBs, pure and Node-testable.
import { clamp } from '../core/math.js';
export function segmentBoxFraction(start, end, box, radius = .22) {
  let near = 0, far = 1;
  for (const axis of ['x', 'y', 'z']) {
    const delta = end[axis] - start[axis];
    const min = box.min[axis] - radius, max = box.max[axis] + radius;
    if (Math.abs(delta) < 1e-8) {
      if (start[axis] < min || start[axis] > max) return null;
    } else {
      let a = (min - start[axis]) / delta, b = (max - start[axis]) / delta;
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return null;
    }
  }
  return near;
}
export function castCameraArm(start, end, boxes, radius = .22) {
  let fraction = 1, hits = 0;
  for (const box of boxes) {
    const hit = segmentBoxFraction(start, end, box, radius);
    if (hit !== null && hit < fraction) { fraction = hit; hits++; }
  }
  const length = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  fraction = Math.max(0, fraction - (hits ? .06 / Math.max(.01, length) : 0));
  return { x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction, z: start.z + (end.z - start.z) * fraction, fraction, hits };
}
export const characterOpacity = distance => distance >= .6 ? 1 : clamp((distance - .2) / .4, 0, 1);
