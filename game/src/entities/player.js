import * as THREE from '../../vendor/three.module.min.js';
import { ProceduralHumanoid } from './humanoid.js';
import { damping, dampAngle } from '../core/math.js';
export class PlayerCharacter {
  constructor(game) {
    this.position = new THREE.Vector3(148, .15, -105); this.previous = this.position.clone();
    this.velocity = new THREE.Vector3(); this.heading = 0; this.previousHeading = 0;
    this.health = 100; this.armour = 50; this.cash = 250; this.mode = 'foot'; this.vehicle = null;
    this.grounded = true; this.sprint = false; this.crouch = false; this.aiming = false;
    this.humanoid = new ProceduralHumanoid(); game.world.scene.add(this.humanoid.root);
    this.entity = game.entities.acquire('player', { transform: this.position, humanoid: this.humanoid, health: this });
  }
  update(dt, game) {
    this.previous.copy(this.position); this.previousHeading = this.heading;
    const input = game.input;
    if (this.mode !== 'foot') {
      if (this.vehicle && this.mode === 'driving') { this.position.copy(this.vehicle.position); this.heading = this.vehicle.heading; }
      this.velocity.set(0, 0, 0); this.humanoid.animate(dt, { driving: true }); return;
    }
    const move = input.move, magnitude = Math.min(1, Math.hypot(move.x, move.y));
    this.sprint = input.down('ShiftLeft') && magnitude > .1 && !this.aiming;
    if (input.consume('KeyC')) this.crouch = !this.crouch;
    this.aiming = input.enabled && input.buttons.has(2);
    const speed = this.crouch ? 1.6 : this.sprint ? 8.2 : this.aiming ? 2.2 : 4.2;
    const yaw = game.cameraRig?.yaw || 0;
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) }, right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    let vx = (forward.x * move.y + right.x * move.x), vz = (forward.z * move.y + right.z * move.x);
    const length = Math.hypot(vx, vz); if (length > 1) { vx /= length; vz /= length; }
    this.velocity.x += (vx * speed - this.velocity.x) * damping(14, dt);
    this.velocity.z += (vz * speed - this.velocity.z) * damping(14, dt);
    if (magnitude > .05) this.heading = dampAngle(this.heading, Math.atan2(vx, vz), 14, dt);
    if (this.aiming) this.heading = dampAngle(this.heading, yaw, 18, dt);
    if (input.consume('Space') && this.grounded && !this.crouch) { this.velocity.y = 6.1; this.grounded = false; }
    this.velocity.y -= 18 * dt;
    const result = game.world.collision.moveCircle(this.position, this.velocity.x * dt, this.velocity.z * dt, .36, this.crouch ? 1.3 : 1.85);
    this.position.x = result.x; this.position.z = result.z; this.position.y += this.velocity.y * dt;
    const floor = game.world.heightAt(this.position.x, this.position.z);
    if (this.position.y <= floor) { this.position.y = floor; this.velocity.y = 0; this.grounded = true; }
    this.humanoid.animate(dt, { speed: Math.hypot(this.velocity.x, this.velocity.z), sprint: this.sprint,
      crouch: this.crouch, grounded: this.grounded, aiming: this.aiming });
  }
  present(alpha) {
    this.humanoid.root.visible = this.mode !== 'driving';
    this.humanoid.root.position.lerpVectors(this.previous, this.position, alpha);
    this.humanoid.root.rotation.y = this.previousHeading + Math.atan2(Math.sin(this.heading - this.previousHeading), Math.cos(this.heading - this.previousHeading)) * alpha;
  }
  teleport(x, y, z, heading = 0) {
    this.position.set(x, y, z); this.previous.copy(this.position); this.heading = this.previousHeading = heading; this.velocity.set(0, 0, 0);
  }
}
