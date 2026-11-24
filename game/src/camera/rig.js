import * as THREE from '../../vendor/three.module.min.js';
import { castCameraArm, characterOpacity } from './arm-collision.js';
import { damping, dampAngle, clamp, lerp } from '../core/math.js';
export const CAMERA_PRESETS = [
  { name: 'Near', distance: 1.8, shoulder: .5, height: 1.55 },
  { name: 'Medium', distance: 2.8, shoulder: .6, height: 1.75 },
  { name: 'Far', distance: 4.2, shoulder: .65, height: 2 },
];
export class ThirdPersonCameraRig {
  constructor(camera, player) {
    this.camera = camera; this.preset = 1; this.yaw = player.heading; this.pitch = .1;
    this.shoulder = 1; this.aimBlend = 0; this.lookIdle = 0; this.fov = 60;
    this.mode = 'foot'; this.collisionHits = 0; this.distance = 2.8; this.trauma = 0;
    this.position = new THREE.Vector3(); this.previous = new THREE.Vector3();
    this.target = new THREE.Vector3(); this.previousTarget = new THREE.Vector3();
    this.pivot = new THREE.Vector3(); this.initialized = false; this.transition = null;
    this.cinematic = false; this.vHold = 0;
  }
  setPreset(index) { this.preset = clamp(Number(index), 0, 2); }
  addTrauma(amount) { this.trauma = clamp(this.trauma + amount, 0, 1); }
  beginTransition(from, to, duration = .35) {
    this.transition = { from: from.clone(), to: to.clone(), elapsed: 0, duration };
  }
  update(dt, game) {
    const player = game.player, input = game.input, preset = CAMERA_PRESETS[this.preset];
    this.previous.copy(this.position); this.previousTarget.copy(this.target);
    const looking = Math.abs(input.lookX) + Math.abs(input.lookY) > .0001;
    if (looking) this.lookIdle = 0; else this.lookIdle += dt;
    this.yaw -= input.lookX; this.pitch = clamp(this.pitch + input.lookY, -.28, .72);
    if (input.consume('KeyX')) this.shoulder *= -1;
    if (input.down('KeyV')) this.vHold += dt;
    if (input.released.has('KeyV')) {
      if (this.vHold > .5 && player.vehicle) this.cinematic = !this.cinematic;
      else this.setPreset((this.preset + 1) % 3);
      this.vHold = 0;
    }
    this.aimBlend += ((player.aiming ? 1 : 0) - this.aimBlend) * damping(15, dt);
    let distance = lerp(preset.distance, 1.65, this.aimBlend), height = preset.height;
    let shoulder = preset.shoulder * this.shoulder;
    const baseFov = game.settings?.fov || 60;
    let fov = lerp(baseFov + (player.sprint ? 6 : 0), 45, this.aimBlend);
    let heading = player.heading;
    this.mode = player.vehicle ? 'vehicle' : player.aiming ? 'aim' : 'foot';
    if (player.vehicle) {
      const car = player.vehicle, speed = Math.abs(car.speed || 0);
      const velocityYaw = Math.hypot(car.velocity.x, car.velocity.z) > 2 ? Math.atan2(car.velocity.x, car.velocity.z) : car.heading;
      heading = dampAngle(car.heading, velocityYaw, .7, 1);
      distance = car.length * (this.preset === 0 ? .95 : this.preset === 2 ? 1.8 : 1.35) + speed * .075;
      height = 2.4 + speed * .01; shoulder = .18;
      fov = baseFov + clamp(speed / 45, 0, 1) * 18;
      if (input.down('KeyB')) heading += Math.PI;
      if (this.lookIdle > 2 || input.down('KeyB')) this.yaw = dampAngle(this.yaw, heading, 3.8, dt);
    } else if (this.lookIdle > 1.5 && Math.hypot(player.velocity.x, player.velocity.z) > .5) this.yaw = dampAngle(this.yaw, heading, 3, dt);
    const desiredPivot = player.position.clone(); desiredPivot.y += player.vehicle ? .9 : height;
    if (this.transition) {
      this.transition.elapsed += dt;
      const t = clamp(this.transition.elapsed / this.transition.duration, 0, 1), eased = t * t * (3 - 2 * t);
      desiredPivot.lerpVectors(this.transition.from, this.transition.to, eased);
      desiredPivot.y += Math.sin(t * Math.PI) * .4;
      if (t === 1) this.transition = null;
    }
    this.pivot.copy(desiredPivot);
    const direction = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desired = desiredPivot.clone().addScaledVector(direction, -distance).addScaledVector(right, shoulder);
    desired.y += .4 + Math.sin(this.pitch) * distance;
    desired.y = Math.max(game.world.heightAt(desired.x, desired.z) + .3, desired.y);
    const boxes = game.world.collision.querySegment(desiredPivot, desired, .24);
    const clipped = castCameraArm(desiredPivot, desired, boxes);
    this.collisionHits = clipped.hits;
    if (!this.initialized) {
      this.position.set(clipped.x, clipped.y, clipped.z); this.target.copy(desiredPivot);
      this.previous.copy(this.position); this.previousTarget.copy(this.target); this.initialized = true;
    } else {
      this.position.lerp(new THREE.Vector3(clipped.x, clipped.y, clipped.z), damping(clipped.hits ? 30 : 8.3, dt));
      this.target.lerp(desiredPivot.clone().addScaledVector(direction, this.aimBlend * 3), damping(16.7, dt));
      const safety = castCameraArm(desiredPivot, this.position, game.world.collision.querySegment(desiredPivot, this.position, .24));
      this.position.set(safety.x, safety.y, safety.z); this.collisionHits += safety.hits;
    }
    this.distance = this.position.distanceTo(desiredPivot);
    player.humanoid.setOpacity(player.vehicle ? 1 : characterOpacity(this.distance));
    this.fov += (fov - this.fov) * damping(10, dt); this.trauma = Math.max(0, this.trauma - dt * 1.2);
  }
  present(alpha, game) {
    this.camera.position.lerpVectors(this.previous, this.position, alpha);
    const target = new THREE.Vector3().lerpVectors(this.previousTarget, this.target, alpha);
    // Interpolation itself must not cross a corner after fixed-tick clipping.
    const safe = castCameraArm(this.pivot, this.camera.position, game.world.collision.querySegment(this.pivot, this.camera.position, .24));
    this.camera.position.set(safe.x, safe.y, safe.z);
    this.camera.lookAt(target);
    if (!game.settings?.reduceMotion && game.player.vehicle) {
      this.camera.rotateZ(clamp(-(game.player.vehicle.steer || 0) * Math.abs(game.player.vehicle.speed) * .0014, -.052, .052));
    }
    this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
  }
  reset(player) { this.initialized = false; this.yaw = player.heading; this.pitch = .1; this.transition = null; }
  get debug() { return { mode: this.mode, preset: CAMERA_PRESETS[this.preset].name, distance: this.distance, fov: this.fov, collisionHits: this.collisionHits }; }
}
