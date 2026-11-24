// One deterministic hash stream for all procedural world and gameplay decisions.
export function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export class SeededRandom {
  constructor(seed = 1) { this.state = hashSeed(seed); }
  next() {
    let t = this.state = (this.state + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.next(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(values) { return values[this.int(0, values.length - 1)]; }
  fork(label) { return new SeededRandom(`${this.state}:${label}`); }
}
