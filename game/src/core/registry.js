// Fixed-budget entity storage and named components: later systems never own the loop.
export class EntityPool {
  constructor(budget = 384) {
    this.budget = budget;
    this.slots = Array(budget).fill(null);
    this.generations = new Uint32Array(budget);
    this.free = Array.from({ length: budget }, (_, i) => budget - i - 1);
    this.components = new Map();
  }
  register(name) {
    if (!this.components.has(name)) this.components.set(name, new Map());
    return this.components.get(name);
  }
  acquire(kind, components = {}) {
    if (!this.free.length) return null;
    const id = this.free.pop();
    const entity = { id, generation: this.generations[id], kind, active: true };
    this.slots[id] = entity;
    for (const [name, data] of Object.entries(components)) this.register(name).set(id, data);
    return entity;
  }
  release(entity) {
    if (this.slots[entity.id] !== entity) return false;
    for (const table of this.components.values()) table.delete(entity.id);
    this.slots[entity.id] = null;
    this.generations[entity.id]++;
    entity.active = false;
    this.free.push(entity.id);
    return true;
  }
  get(entity, name) { return this.components.get(name)?.get(entity.id); }
  *query(...names) {
    for (const entity of this.slots) {
      if (entity && names.every(name => this.components.get(name)?.has(entity.id))) yield entity;
    }
  }
  get count() { return this.budget - this.free.length; }
}
export class SystemRegistry {
  constructor() { this.list = []; }
  register(name, update, order = 100) {
    if (this.list.some(system => system.name === name)) throw new Error(`Duplicate system: ${name}`);
    const system = { name, update, order, enabled: true };
    this.list.push(system);
    this.list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return system;
  }
  remove(name) { this.list = this.list.filter(system => system.name !== name); }
  update(dt, game) { for (const system of this.list) if (system.enabled) system.update(dt, game); }
}
