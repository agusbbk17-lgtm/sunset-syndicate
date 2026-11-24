// Fixed work, not wall-clock work: seed replay never depends on processor speed.
export class AgentScheduler {
  constructor(capacity = 256, slice = 16) {
    this.capacity = capacity; this.slice = slice; this.count = 0; this.cursor = 0;
    this.tick = 0; this.lastWork = 0; this.maxWork = 0;
    this.agents = new Array(capacity); this.owners = new Array(capacity);
    this.lastTicks = new Uint32Array(capacity);
    this.shots = Array.from({ length: 16 }, () => ({ x: 0, z: 0, expires: 0, serial: 0 }));
    this.shotSerial = 0;
  }
  gunshot(x, z, time) {
    const shot = this.shots[this.shotSerial++ % this.shots.length];
    shot.x = x; shot.z = z; shot.expires = time + 2; shot.serial = this.shotSerial;
  }
  reset() {
    this.tick = 0; this.cursor = 0; this.lastTicks.fill(0); this.shotSerial = 0;
    for (const shot of this.shots) { shot.serial = 0; shot.expires = 0; }
  }
  register(agent, owner) {
    if (this.count === this.capacity) return false;
    this.agents[this.count] = agent; this.owners[this.count] = owner;
    this.lastTicks[this.count++] = this.tick; return true;
  }
  update(dt, game) {
    this.tick++; this.lastWork = 0;
    const end = Math.min(this.slice, this.count);
    for (let i = 0; i < end; i++) {
      const index = this.cursor, agent = this.agents[index];
      this.cursor = (index + 1) % this.count;
      const elapsed = (this.tick - this.lastTicks[index]) * dt;
      this.lastTicks[index] = this.tick;
      if (!agent.active) continue;
      this.owners[index].decide(agent, elapsed, game); this.lastWork++;
    }
    this.maxWork = Math.max(this.maxWork, this.lastWork);
  }
}
export class AgentPool {
  constructor(capacity, factory) {
    this.capacity = capacity; this.count = 0; this.highWater = 0;
    this.slots = new Array(capacity); this.free = new Int32Array(capacity); this.freeCount = capacity;
    for (let i = 0; i < capacity; i++) {
      this.slots[i] = factory(i); this.slots[i].active = false; this.slots[i].id = i;
      this.free[i] = capacity - 1 - i;
    }
  }
  acquire() {
    if (!this.freeCount) return null;
    const agent = this.slots[this.free[--this.freeCount]]; agent.active = true;
    this.count++; this.highWater = Math.max(this.highWater, this.count); return agent;
  }
  release(agent) {
    if (!agent || this.slots[agent.id] !== agent || !agent.active) return false;
    agent.active = false; this.free[this.freeCount++] = agent.id; this.count--; return true;
  }
  capture() {
    this.initial = this.slots.map(agent => ({ values: { ...agent }, position: { ...agent.position },
      velocity: agent.velocity ? { ...agent.velocity } : null, rngState: agent.rng.state }));
  }
  reset() {
    this.count = 0; this.freeCount = 0;
    for (let i = 0; i < this.capacity; i++) {
      const agent = this.slots[i], initial = this.initial[i];
      Object.assign(agent, initial.values); Object.assign(agent.position, initial.position); Object.assign(agent.previous, initial.position);
      if (agent.velocity) Object.assign(agent.velocity, initial.velocity);
      agent.rng.state = initial.rngState;
      if (agent.active) this.count++; else this.free[this.freeCount++] = i;
    }
  }
}
