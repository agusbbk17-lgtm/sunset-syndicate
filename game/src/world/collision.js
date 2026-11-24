import { clamp } from '../core/math.js';
export class WorldCollision {
  constructor(cellSize = 60) { this.cellSize = cellSize; this.cells = new Map(); this.boxes = []; }
  add(min, max, tag = 'building') {
    const box = { min, max, tag, id: this.boxes.length }; this.boxes.push(box);
    for (let x = Math.floor(min.x / this.cellSize); x <= Math.floor(max.x / this.cellSize); x++) {
      for (let z = Math.floor(min.z / this.cellSize); z <= Math.floor(max.z / this.cellSize); z++) {
        const key = `${x},${z}`;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(box);
      }
    }
    return box;
  }
  query(x, z, radius = 6) {
    const result = new Set();
    for (let cx = Math.floor((x - radius) / this.cellSize); cx <= Math.floor((x + radius) / this.cellSize); cx++) {
      for (let cz = Math.floor((z - radius) / this.cellSize); cz <= Math.floor((z + radius) / this.cellSize); cz++) {
        for (const box of this.cells.get(`${cx},${cz}`) || []) result.add(box);
      }
    }
    return [...result];
  }
  querySegment(start, end, radius = .5) {
    return this.query((start.x + end.x) / 2, (start.z + end.z) / 2,
      Math.max(Math.abs(end.x - start.x), Math.abs(end.z - start.z)) / 2 + radius);
  }
  moveCircle(position, dx, dz, radius = .35, height = 1.8) {
    let x = position.x + dx, z = position.z + dz, hit = false;
    const boxes = this.query(x, z, radius + Math.max(Math.abs(dx), Math.abs(dz)));
    for (let iteration = 0; iteration < 3; iteration++) for (const box of boxes) {
      if (position.y + height < box.min.y || position.y > box.max.y) continue;
      const nx = clamp(x, box.min.x, box.max.x), nz = clamp(z, box.min.z, box.max.z);
      const vx = x - nx, vz = z - nz, distance = Math.hypot(vx, vz);
      if (distance >= radius) continue;
      hit = true;
      if (distance > .0001) { x += vx / distance * (radius - distance); z += vz / distance * (radius - distance); }
      else {
        const edges = [Math.abs(x - box.min.x), Math.abs(x - box.max.x), Math.abs(z - box.min.z), Math.abs(z - box.max.z)];
        const edge = edges.indexOf(Math.min(...edges));
        if (edge === 0) x = box.min.x - radius;
        if (edge === 1) x = box.max.x + radius;
        if (edge === 2) z = box.min.z - radius;
        if (edge === 3) z = box.max.z + radius;
      }
    }
    return { x: clamp(x, -735, 235), z: clamp(z, -735, 735), hit };
  }
  inside(point, radius = 0) {
    return this.query(point.x, point.z, radius).some(box =>
      point.x > box.min.x - radius && point.x < box.max.x + radius &&
      point.y > box.min.y - radius && point.y < box.max.y + radius &&
      point.z > box.min.z - radius && point.z < box.max.z + radius);
  }
}
