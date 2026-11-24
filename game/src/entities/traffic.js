import * as THREE from '../../vendor/three.module.min.js';
import { AgentPool } from '../systems/ai.js';
import { signalPhase } from '../world/lanes.js';
import { ProceduralVehicleModel } from './vehicle-model.js';
import { VEHICLE_TYPES } from '../data/vehicles.js';
import { InstancedModel } from './instanced-model.js';
export class TrafficPool extends AgentPool {
  constructor(game, capacity = 64, render = true) {
    const rng = game.rng.fork('traffic'), spec = VEHICLE_TYPES.sedan;
    super(capacity, id => ({ rng: rng.fork(id), position: { x: 0, y: .15, z: 0 }, previous: { x: 0, y: .15, z: 0 },
      velocity: { x: 0, z: 0 }, lane: 0, progress: 0, heading: 0, previousHeading: 0,
      speed: 0, targetSpeed: 0, gear: 1, rpm: 850, spec, length: spec.length,
      blocked: 0, hornCooldown: rng.range(0, 4), panic: false, turning: false,
      turnProgress: 0, turnLength: 0, turnX: 0, turnZ: 0, turnNode: -1, nextLane: 0 }));
    this.game = game; this.graph = game.world.roads; this.honks = 0; this.stops = 0; this.turns = 0;
    this.occupants = new Int32Array(this.graph.nodes.length).fill(-1);
    this.template = render ? new ProceduralVehicleModel('sedan', spec, 'white') : null;
    this.batch = render ? new InstancedModel(game.world.scene, this.template, capacity) : null;
    const color = render ? new THREE.Color() : null, palette = ['#f2c273', '#799ca4', '#b86754', '#ded8c9', '#526779', '#9b87a6'];
    for (const car of this.slots) {
      if (game.entities) car.entity = game.entities.acquire('traffic', { traffic: car, transform: car.position });
      game.ai?.register(car, this);
      if (this.batch) this.batch.color(car.id, this.template.paint, color.set(car.rng.pick(palette)));
    }
    this.nearLanes = this.graph.lanes.filter(lane => Math.hypot(lane.ax - game.player.position.x, lane.az - game.player.position.z) < 270);
  }
  spawn() {
    const car = this.acquire(); if (!car) return null;
    const lanes = car.id < 24 && this.nearLanes.length ? this.nearLanes : this.graph.lanes;
    car.lane = lanes[car.rng.int(0, lanes.length - 1)].id;
    const lane = this.graph.lanes[car.lane];
    car.progress = lane.length * (.15 + car.rng.next() * .65);
    for (const other of this.slots) if (other.active && other !== car && other.lane === car.lane && Math.abs(other.progress - car.progress) < 12) {
      car.lane = (car.lane + 1) % this.graph.lanes.length; car.progress = 20;
    }
    const start = this.graph.lanes[car.lane];
    car.position.x = start.ax + start.ux * car.progress; car.position.z = start.az + start.uz * car.progress;
    car.previous.x = car.position.x; car.previous.z = car.position.z;
    car.heading = car.previousHeading = Math.atan2(start.ux, start.uz);
    car.speed = car.targetSpeed = start.speedLimit * .65; car.turning = false; car.blocked = 0;
    car.velocity.x = start.ux * car.speed; car.velocity.z = start.uz * car.speed; return car;
  }
  rayDistance(car, obstacle, maxDistance) {
    if (obstacle === car || obstacle.active === false) return maxDistance;
    const dx = obstacle.position.x - car.position.x, dz = obstacle.position.z - car.position.z;
    const ux = Math.sin(car.heading), uz = Math.cos(car.heading), along = dx * ux + dz * uz;
    if (along <= 0 || along > maxDistance + 5 || Math.abs(dx * uz - dz * ux) > 2.2) return maxDistance;
    return Math.min(maxDistance, Math.max(0, along - (car.length + (obstacle.length || 4.5)) / 2));
  }
  decide(car, elapsed, game) {
    const lane = this.graph.lanes[car.lane], player = game.player;
    car.panic = (game.wanted?.stars || game.wanted?.level || 0) > 0 &&
      Math.hypot(car.position.x - player.position.x, car.position.z - player.position.z) < 160;
    let gap = 32;
    for (const other of this.slots) if (other.active) gap = this.rayDistance(car, other, gap);
    if (player.vehicle) gap = this.rayDistance(car, player.vehicle, gap);
    // Three short, parallel rays against nearby static collision boxes.
    const ux = Math.sin(car.heading), uz = Math.cos(car.heading);
    if (game.world.collision) for (const box of game.world.collision.boxes) {
      if (box.min.y > 1.6 || Math.abs((box.min.x + box.max.x) / 2 - car.position.x) > 65 ||
        Math.abs((box.min.z + box.max.z) / 2 - car.position.z) > 65) continue;
      for (let ray = -1; ray <= 1; ray++) {
        const ox = car.position.x + uz * ray * .65, oz = car.position.z - ux * ray * .65;
        const tx1 = ux ? (box.min.x - ox) / ux : -Infinity, tx2 = ux ? (box.max.x - ox) / ux : Infinity;
        const tz1 = uz ? (box.min.z - oz) / uz : -Infinity, tz2 = uz ? (box.max.z - oz) / uz : Infinity;
        if (!ux && (ox < box.min.x || ox > box.max.x) || !uz && (oz < box.min.z || oz > box.max.z)) continue;
        const enter = Math.max(0, Math.min(tx1, tx2), Math.min(tz1, tz2)), exit = Math.min(Math.max(tx1, tx2), Math.max(tz1, tz2));
        if (exit >= enter) gap = Math.min(gap, Math.max(0, enter - car.length / 2));
      }
    }
    if (!car.turning && signalPhase(this.graph, lane.to, lane.approach, game.loop.time) !== 'green') gap = Math.min(gap, lane.length - car.progress);
    const cruise = lane.speedLimit * (car.panic ? 1.25 : .8 + car.id % 4 * .045);
    car.targetSpeed = Math.min(cruise, Math.sqrt(Math.max(0, gap - 3) * 10));
    car.hornCooldown = Math.max(0, car.hornCooldown - elapsed);
    if (car.speed < .5 && car.targetSpeed < 1) car.blocked += elapsed; else car.blocked = 0;
    if ((car.blocked > 4 || car.panic) && car.hornCooldown <= 0) {
      car.hornCooldown = 6 + car.rng.next() * 5; this.honks++;
      if (Math.hypot(car.position.x - player.position.x, car.position.z - player.position.z) < 65) game.audio?.honk();
    }
  }
  chooseNext(car, lane) {
    const choices = lane.next; let next = lane.id;
    for (let i = 0; i < 8; i++) {
      next = choices[car.rng.int(0, choices.length - 1)];
      if (this.graph.lanes[next].to !== lane.from || choices.length === 1) break;
    }
    return next;
  }
  update(dt) {
    const time = this.game.loop.time;
    for (const car of this.slots) {
      if (!car.active) continue;
      car.previous.x = car.position.x; car.previous.z = car.position.z; car.previousHeading = car.heading;
      car.speed += Math.max(-8 * dt, Math.min(3.5 * dt, car.targetSpeed - car.speed));
      const lane = this.graph.lanes[car.lane];
      if (car.turning) {
        car.turnProgress = Math.min(car.turnLength, car.turnProgress + car.speed * dt);
        const t = car.turnProgress / car.turnLength, u = 1 - t, node = this.graph.nodes[car.turnNode], next = this.graph.lanes[car.nextLane];
        car.position.x = u * u * car.turnX + 2 * u * t * node.x + t * t * next.ax;
        car.position.z = u * u * car.turnZ + 2 * u * t * node.z + t * t * next.az;
        car.heading = Math.atan2(u * (node.x - car.turnX) + t * (next.ax - node.x), u * (node.z - car.turnZ) + t * (next.az - node.z));
        if (t === 1) { this.occupants[car.turnNode] = -1; car.lane = car.nextLane; car.progress = 0; car.turning = false; }
      } else {
        let limit = lane.length;
        for (const other of this.slots) if (other.active && other !== car && !other.turning && other.lane === car.lane && other.progress > car.progress) {
          limit = Math.min(limit, other.progress - car.length - 2.5);
        }
        const previous = car.progress;
        car.progress = Math.max(previous, Math.min(limit, previous + car.speed * dt));
        if (car.progress === previous && car.speed > .1) car.speed = 0;
        car.position.x = lane.ax + lane.ux * car.progress; car.position.z = lane.az + lane.uz * car.progress;
        car.heading = Math.atan2(lane.ux, lane.uz);
        if (car.progress >= lane.length) {
          if (signalPhase(this.graph, lane.to, lane.approach, time) === 'green' && this.occupants[lane.to] < 0) {
            car.nextLane = this.chooseNext(car, lane); const next = this.graph.lanes[car.nextLane];
            car.turning = true; car.turnNode = lane.to; car.turnX = car.position.x; car.turnZ = car.position.z;
            car.turnProgress = 0; car.turnLength = Math.max(10, Math.hypot(next.ax - car.turnX, next.az - car.turnZ) * 1.3);
            this.occupants[lane.to] = car.id; this.turns++;
          } else { if (car.speed > 0) this.stops++; car.speed = 0; }
        }
      }
      car.velocity.x = (car.position.x - car.previous.x) / dt; car.velocity.z = (car.position.z - car.previous.z) / dt;
      car.gear = Math.max(1, Math.min(4, Math.floor(car.speed / 7) + 1)); car.rpm = 850 + (car.speed % 7) * 510;
    }
  }
  release(car) {
    if (car?.turning && this.occupants[car.turnNode] === car.id) this.occupants[car.turnNode] = -1;
    return super.release(car);
  }
  resolvePlayer() {
    const player = this.game.player.vehicle;
    if (!player) return;
    const ac = Math.cos(player.heading), as = Math.sin(player.heading);
    for (const car of this.slots) {
      if (!car.active) continue;
      const dx = player.position.x - car.position.x, dz = player.position.z - car.position.z;
      if (dx * dx + dz * dz > 30) continue;
      const bc = Math.cos(car.heading), bs = Math.sin(car.heading);
      let minimum = Infinity, nx = 0, nz = 0;
      for (let axis = 0; axis < 4; axis++) {
        const x = axis === 0 ? ac : axis === 1 ? as : axis === 2 ? bc : bs;
        const z = axis === 0 ? -as : axis === 1 ? ac : axis === 2 ? -bs : bc;
        const a = Math.abs(x * ac - z * as) * player.spec.width / 2 + Math.abs(x * as + z * ac) * player.length / 2;
        const b = Math.abs(x * bc - z * bs) * car.spec.width / 2 + Math.abs(x * bs + z * bc) * car.length / 2;
        const distance = dx * x + dz * z, penetration = a + b - Math.abs(distance);
        if (penetration <= 0) { minimum = 0; break; }
        if (penetration < minimum) { minimum = penetration; nx = x * (distance >= 0 ? 1 : -1); nz = z * (distance >= 0 ? 1 : -1); }
      }
      if (minimum <= 0) continue;
      player.position.x += nx * (minimum + .02); player.position.z += nz * (minimum + .02);
      const speed = -(player.velocity.x * nx + player.velocity.z * nz);
      if (speed > 0) {
        player.velocity.x += nx * speed; player.velocity.z += nz * speed;
        player.speed = player.velocity.x * as + player.velocity.z * ac;
        player.health = Math.max(0, player.health - speed * .2);
        this.game.cameraRig?.addTrauma(Math.min(.4, speed * .02)); this.game.audio?.impact(speed);
      }
    }
  }
  present(alpha) {
    if (!this.batch) return;
    const player = this.game.player.position;
    for (const car of this.slots) {
      for (const wheel of this.template.wheels) wheel.pivot.rotation.x = (car.progress + car.turnProgress) / wheel.radius;
      this.batch.write(car, alpha, Math.abs(car.position.x - player.x) < 340 && Math.abs(car.position.z - player.z) < 340);
    }
    this.batch.flush();
  }
}
