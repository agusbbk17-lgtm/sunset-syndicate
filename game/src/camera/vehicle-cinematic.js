import * as THREE from '../../vendor/three.module.min.js';
export class VehicleCinematicDirector {
  constructor() { this.cut = 0; this.elapsed = 0; this.active = false; }
  pose(dt, car, rig) {
    this.active = !!rig.cinematic;
    if (!this.active) return null;
    this.elapsed += dt;
    if (this.elapsed >= 4.5 && Math.abs(car.steer) < .25) { this.cut = (this.cut + 1) % 4; this.elapsed = 0; }
    const forward = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
    const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    const offsets = [[.75, 1.4, 1.8], [1.1, .5, 2.8], [5, 1.2, 4], [-1.5, .85, -1.2]];
    const [x, y, z] = offsets[this.cut];
    const position = car.position.clone().addScaledVector(side, x).addScaledVector(forward, z); position.y += y;
    const target = car.position.clone().addScaledVector(forward, this.cut < 2 ? 12 : 0); target.y += .8;
    return { position, target };
  }
}
