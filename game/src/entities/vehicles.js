import * as THREE from '../../vendor/three.module.min.js';
import { VEHICLE_TYPES } from '../data/vehicles.js';
import { ProceduralVehicleModel } from './vehicle-model.js';
import { updateArcadeDrivetrain, resolveVehicleWorld, orientedBoxOverlap } from '../systems/vehicle-physics.js';
import { smoothstep } from '../core/math.js';
export class VehicleFleet {
  constructor(game, budget = 64) { this.game = game; this.budget = budget; this.cars = []; this.transition = null; this.impactEvents = []; }
  spawn(type, x, z, heading = 0, options = {}) {
    if (this.cars.length >= this.budget || !VEHICLE_TYPES[type]) return null;
    const spec = VEHICLE_TYPES[type], position = new THREE.Vector3(x, this.game.world.heightAt(x, z), z);
    const car = {
      type, spec, name: spec.name, length: spec.length, position, previous: position.clone(), heading, previousHeading: heading,
      velocity: new THREE.Vector3(), speed: 0, steer: 0, throttle: 0, braking: 0, handbrake: false,
      rpm: 850, gear: 1, roll: 0, pitch: 0, health: 100, damage: 0, driver: null, lights: false,
      controls: { throttle: 0, brake: 0, steer: 0 }, ai: options.ai || null,
    };
    const entity = this.game.entities.acquire('vehicle', { transform: car.position, vehicle: car });
    if (!entity) return null;
    car.entity = entity; car.model = new ProceduralVehicleModel(type, spec, options.color || spec.color);
    this.game.world.scene.add(car.model.root); this.cars.push(car); return car;
  }
  remove(car) {
    const index = this.cars.indexOf(car); if (index < 0) return;
    this.game.world.scene.remove(car.model.root); this.game.entities.release(car.entity); this.cars.splice(index, 1);
  }
  updatePhysics(dt) {
    const game = this.game;
    this.impactEvents.length = 0;
    for (const car of this.cars) {
      car.previous.copy(car.position); car.previousHeading = car.heading;
      let controls = car.controls;
      if (car.driver === game.player && game.player.mode === 'driving') {
        const move = game.input.move;
        controls = { throttle: move.y + (game.input.padThrottle || 0) - (game.input.padBrake || 0), steer: move.x,
          brake: move.y < 0 && car.speed > 1 ? 1 : 0, handbrake: game.input.down('Space') };
        if (controls.brake) controls.throttle = 0;
      }
      const movement = updateArcadeDrivetrain(car, controls, dt);
      const impact = resolveVehicleWorld(car, game.world.collision, movement.dx, movement.dz);
      car.position.y = game.world.heightAt(car.position.x, car.position.z);
      if (impact > 2) {
        car.health = Math.max(0, car.health - impact * .5); car.damage = Math.min(1, car.damage + impact * .006);
        this.impactEvents.push({ car, speed: impact }); if (car.driver === game.player) game.cameraRig.addTrauma(impact * .015);
      }
      car.lights = game.world.sky.material.uniforms.night.value > .5;
      car.model.animate(dt, car, game.loop?.time || 0);
    }
    // SAT impulses between vehicles; traffic can be added without changing physics.
    for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
      const a = this.cars[i], b = this.cars[j];
      if (a.position.distanceTo(b.position) > a.length + b.length) continue;
      const overlap = orientedBoxOverlap({ x: a.position.x, z: a.position.z, width: a.spec.width, length: a.length, heading: a.heading },
        { x: b.position.x, z: b.position.z, width: b.spec.width, length: b.length, heading: b.heading });
      if (!overlap) continue;
      const shift = overlap.penetration / 2 + .005;
      a.position.x += overlap.normal.x * shift; a.position.z += overlap.normal.z * shift;
      b.position.x -= overlap.normal.x * shift; b.position.z -= overlap.normal.z * shift;
      const relative = (a.velocity.x - b.velocity.x) * overlap.normal.x + (a.velocity.z - b.velocity.z) * overlap.normal.z;
      if (relative < 0) {
        a.velocity.x -= relative * overlap.normal.x * .6; a.velocity.z -= relative * overlap.normal.z * .6;
        b.velocity.x += relative * overlap.normal.x * .6; b.velocity.z += relative * overlap.normal.z * .6;
        this.impactEvents.push({ car: a, other: b, speed: -relative });
      }
    }
  }
  nearest(position, radius = 5.5) {
    let result = null, distance = radius;
    for (const car of this.cars) {
      const next = Math.hypot(car.position.x - position.x, car.position.z - position.z);
      if (next < distance) { result = car; distance = next; }
    }
    return result;
  }
  seatPlayer(car) {
    const player = this.game.player;
    if (player.vehicle) player.vehicle.driver = null;
    player.vehicle = car; car.driver = player; player.mode = 'driving'; player.position.copy(car.position); player.previous.copy(player.position);
    player.heading = player.previousHeading = car.heading; this.game.cameraRig.reset(player);
  }
  exitPoint(car) {
    const world = this.game.world;
    for (const side of [-1, 1]) {
      const point = car.position.clone().add(new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading)).multiplyScalar((car.spec.width / 2 + .85) * side));
      point.y = world.heightAt(point.x, point.z);
      if (!world.collision.inside({ x: point.x, y: point.y + .9, z: point.z }, .4)) return point;
    }
    return null;
  }
  interact() {
    const player = this.game.player;
    if (this.transition) return false;
    const car = player.vehicle || this.nearest(player.position);
    if (!car || Math.abs(car.speed) > 4) return false;
    const entering = player.mode === 'foot', destination = entering ? car.position.clone() : this.exitPoint(car);
    if (!destination) return false;
    const fromPivot = this.game.cameraRig.pivot.clone(), toPivot = destination.clone(); toPivot.y += entering ? .9 : 1.75;
    this.game.cameraRig.beginTransition(fromPivot, toPivot, .35);
    this.transition = { car, entering, from: player.position.clone(), to: destination, elapsed: 0, duration: .35, heading: player.heading };
    player.mode = entering ? 'entering' : 'exiting'; player.vehicle = car;
    car.controls = { throttle: 0, brake: 1, steer: 0 };
    return true;
  }
  updateInteraction(dt) {
    const game = this.game, player = game.player;
    if (game.input.consume('KeyE') || game.input.consume('KeyF')) this.interact();
    if (!this.transition) return;
    const transition = this.transition; transition.elapsed += dt;
    const t = Math.min(1, transition.elapsed / transition.duration), eased = smoothstep(t);
    player.position.lerpVectors(transition.from, transition.to, eased);
    player.position.y += Math.sin(t * Math.PI) * .12;
    player.heading = transition.heading + Math.atan2(Math.sin(transition.car.heading - transition.heading), Math.cos(transition.car.heading - transition.heading)) * eased;
    player.humanoid.body.rotation.y = Math.sin(t * Math.PI) * .25;
    if (t >= 1) {
      player.humanoid.body.rotation.y = 0;
      if (transition.entering) { player.mode = 'driving'; transition.car.driver = player; }
      else { player.mode = 'foot'; transition.car.driver = null; player.vehicle = null; player.velocity.set(0, 0, 0); }
      this.transition = null;
    }
  }
  present(alpha) {
    for (const car of this.cars) {
      car.model.root.position.lerpVectors(car.previous, car.position, alpha);
      car.model.root.rotation.y = car.previousHeading + Math.atan2(Math.sin(car.heading - car.previousHeading), Math.cos(car.heading - car.previousHeading)) * alpha;
      car.model.chassis.scale.z = 1 - car.damage * .08;
    }
  }
}
