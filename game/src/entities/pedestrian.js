import { AgentPool } from '../systems/ai.js';
import { walkSignal } from '../world/lanes.js';
import { ProceduralHumanoid } from './humanoid.js';
import { InstancedModel } from './instanced-model.js';
import * as THREE from '../../vendor/three.module.min.js';
export class PedestrianPool extends AgentPool {
  constructor(game, capacity = 192, render = true) {
    const rng = game.rng.fork('pedestrians');
    super(capacity, id => ({ position: { x: 0, y: .26, z: 0 }, previous: { x: 0, y: .26, z: 0 },
      rng: rng.fork(id), heading: 0, previousHeading: 0, node: 0, edge: -1, progress: 0,
      speed: 0, state: 'wander', timer: 0, phase: rng.range(0, 6.28), tilt: 0, previousTilt: 0,
      threatX: 0, threatZ: 0, lastShot: 0, waitSeconds: 0 }));
    this.game = game; this.graph = game.world.roads.sidewalk; this.topples = 0; this.flees = 0; this.crossings = 0;
    this.template = render ? new ProceduralHumanoid({ jacket: 'white', trousers: 'white', skin: 'white' }) : null;
    this.batch = render ? new InstancedModel(game.world.scene, this.template, capacity) : null;
    const palette = ['#d99865', '#578b8b', '#8e759c', '#9eaa73', '#d8c6a1', '#455968'];
    const color = render ? new THREE.Color() : null;
    for (const agent of this.slots) {
      if (game.entities) agent.entity = game.entities.acquire('pedestrian', { pedestrian: agent, transform: agent.position });
      game.ai?.register(agent, this);
      if (this.batch) {
        this.batch.color(agent.id, this.template.materials.jacket, color.set(agent.rng.pick(palette)));
        this.batch.color(agent.id, this.template.materials.skin, color.set(agent.rng.pick(['#ba835f', '#e0b293', '#865842'])));
        this.batch.color(agent.id, this.template.materials.trousers, color.set('#304453'));
      }
    }
    this.nearNodes = this.graph.nodes.filter(node => Math.hypot(node.x - game.player.position.x, node.z - game.player.position.z) < 240);
  }
  spawn() {
    const agent = this.acquire(); if (!agent) return null;
    const nodes = agent.id < 48 && this.nearNodes.length ? this.nearNodes : this.graph.nodes;
    const node = nodes[agent.rng.int(0, nodes.length - 1)];
    agent.node = node.id; agent.edge = -1; agent.progress = 0; agent.speed = 0;
    agent.state = 'wander'; agent.timer = 0; agent.tilt = agent.previousTilt = 0;
    agent.position.x = node.x; agent.position.z = node.z;
    this.chooseEdge(agent, false);
    if (agent.edge >= 0 && this.graph.edges[agent.edge].crossing < 0) {
      const edge = this.graph.edges[agent.edge], to = this.graph.nodes[edge.to];
      agent.progress = agent.rng.range(0, edge.length);
      agent.position.x += (to.x - node.x) * agent.progress / edge.length;
      agent.position.z += (to.z - node.z) * agent.progress / edge.length;
    }
    agent.previous.x = agent.position.x; agent.previous.z = agent.position.z; agent.previousHeading = agent.heading;
    return agent;
  }
  chooseEdge(agent, fleeing) {
    const node = this.graph.nodes[agent.node]; let chosen = -1, best = -Infinity;
    for (let i = 0; i < node.edges.length; i++) {
      const id = node.edges[i], edge = this.graph.edges[id], to = this.graph.nodes[edge.to];
      let score = agent.rng.next();
      if (edge.crossing >= 0) score -= .35;
      if (fleeing) score += ((to.x - node.x) * (node.x - agent.threatX) + (to.z - node.z) * (node.z - agent.threatZ)) / edge.length;
      if (score > best) { best = score; chosen = id; }
    }
    agent.edge = chosen; agent.progress = 0;
    if (chosen >= 0) {
      const to = this.graph.nodes[this.graph.edges[chosen].to]; agent.heading = Math.atan2(to.x - node.x, to.z - node.z);
    }
  }
  flee(agent, x, z) {
    if (agent.state === 'toppled') return;
    if (agent.state !== 'flee') this.flees++;
    agent.state = 'flee'; agent.timer = 5; agent.threatX = x; agent.threatZ = z;
    if (agent.edge < 0 || agent.progress === 0) this.chooseEdge(agent, true);
  }
  strike(agent, car) {
    if (agent.state === 'toppled' || Math.abs(car.speed) < 2) return false;
    const dx = agent.position.x - car.position.x, dz = agent.position.z - car.position.z;
    const forward = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    const lateral = dx * Math.cos(car.heading) - dz * Math.sin(car.heading);
    if (Math.abs(lateral) > (car.spec?.width || 1.9) / 2 + .3 || Math.abs(forward) > (car.length || 4.5) / 2 + .3) return false;
    agent.state = 'toppled'; agent.timer = 6; agent.speed = 0; agent.heading = car.heading; this.topples++;
    this.game.audio?.impact(Math.abs(car.speed)); return true;
  }
  decide(agent, elapsed, game) {
    if (agent.state === 'toppled') return;
    for (const shot of game.ai?.shots || []) {
      if (shot.serial > agent.lastShot && shot.expires > game.loop.time &&
        Math.hypot(agent.position.x - shot.x, agent.position.z - shot.z) < 95) this.flee(agent, shot.x, shot.z);
      agent.lastShot = Math.max(agent.lastShot, shot.serial);
    }
    const cars = game.traffic?.slots;
    if (cars) for (const car of cars) if (car.active) this.checkThreat(agent, car);
    if (game.player.vehicle) this.checkThreat(agent, game.player.vehicle);
    if (agent.edge < 0) this.chooseEdge(agent, agent.state === 'flee');
  }
  checkThreat(agent, car) {
    const dx = agent.position.x - car.position.x, dz = agent.position.z - car.position.z;
    const distance = dx * dx + dz * dz;
    if (distance < 18 * 18 && Math.abs(car.speed) > 4 &&
      dx * car.velocity.x + dz * car.velocity.z > 1) this.flee(agent, car.position.x, car.position.z);
  }
  update(dt) {
    const game = this.game, time = game.loop.time;
    for (const agent of this.slots) {
      if (!agent.active) continue;
      agent.previous.x = agent.position.x; agent.previous.z = agent.position.z;
      agent.previous.y = agent.position.y; agent.previousHeading = agent.heading; agent.previousTilt = agent.tilt;
      if (agent.state === 'toppled') {
        agent.timer -= dt; agent.tilt = Math.min(Math.PI / 2, agent.tilt + dt * 5);
        if (agent.timer <= 0) {
          let best = this.graph.nodes[0], distance = Infinity;
          for (const node of this.graph.nodes) {
            const next = Math.hypot(node.x - agent.position.x, node.z - agent.position.z);
            if (next < distance) { distance = next; best = node; }
          }
          agent.node = best.id; agent.edge = -1; agent.state = 'wander'; agent.tilt = 0;
          agent.position.x = best.x; agent.position.z = best.z; this.chooseEdge(agent, false);
        }
        continue;
      }
      if (game.player.vehicle) this.strike(agent, game.player.vehicle);
      if (game.traffic) for (const car of game.traffic.slots) {
        if (car.active && Math.abs(car.position.x - agent.position.x) < 4 && Math.abs(car.position.z - agent.position.z) < 4) this.strike(agent, car);
      }
      if (agent.state === 'toppled' || agent.edge < 0) continue;
      if (agent.state === 'flee') { agent.timer -= dt; if (agent.timer <= 0) agent.state = 'wander'; }
      const edge = this.graph.edges[agent.edge], from = this.graph.nodes[edge.from], to = this.graph.nodes[edge.to];
      const crossing = edge.crossing >= 0;
      if (crossing && agent.progress === 0 && !walkSignal(game.world.roads, edge.crossing, time, edge.length / 3.5)) {
        agent.speed = 0; agent.waitSeconds += dt; if (agent.state !== 'flee') agent.state = 'wait'; continue;
      }
      if (agent.state === 'wait') agent.state = 'wander';
      const speed = agent.state === 'flee' ? 4.8 : crossing ? 3.5 : 1.25 + agent.id % 5 * .12;
      if (crossing && agent.progress === 0) this.crossings++;
      agent.speed = speed; agent.progress = Math.min(edge.length, agent.progress + speed * dt); agent.phase += speed * dt * 2.8;
      agent.position.x = from.x + (to.x - from.x) * agent.progress / edge.length;
      agent.position.z = from.z + (to.z - from.z) * agent.progress / edge.length;
      if (agent.progress >= edge.length) { agent.node = edge.to; agent.edge = -1; }
    }
  }
  present(alpha) {
    if (!this.batch) return;
    const player = this.game.player.position, template = this.template;
    for (const agent of this.slots) {
      const visible = Math.abs(agent.position.x - player.x) < 280 && Math.abs(agent.position.z - player.z) < 280;
      if (agent.active && visible) {
        const wave = Math.sin(agent.phase), stride = Math.min(.8, agent.speed * .15);
        for (let i = 0; i < 2; i++) {
          template.legs[i].rotation.x = wave * stride * (i ? -1 : 1);
          template.arms[i].rotation.x = -wave * stride * (i ? -1 : 1);
          template.arms[i].rotation.z = agent.state === 'toppled' ? (i ? -.7 : .7) : 0;
        }
        template.body.position.y = Math.abs(wave) * stride * .04;
        template.body.rotation.x = agent.previousTilt + (agent.tilt - agent.previousTilt) * alpha;
      }
      this.batch.write(agent, alpha, visible);
    }
    this.batch.flush();
  }
}
