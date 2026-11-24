import * as THREE from '../../vendor/three.module.min.js';
import { instanceBoxes, STREET_X, STREET_Z } from './roads.js';
export class CityBuildingChunks {
  constructor(scene, rng, textures, collision) {
    this.chunks = []; this.count = 0;
    const materials = [0, 1, 2, 3].map(style => new THREE.MeshStandardMaterial({
      map: textures.facade(style), color: '#f1eeea', roughness: style === 1 ? .28 : .72,
      metalness: style === 1 ? .32 : .04,
    }));
    const trimMaterial = new THREE.MeshStandardMaterial({ color: '#bfc5bf', roughness: .65 });
    for (let ix = 0; ix < STREET_X.length - 1; ix++) for (let iz = 0; iz < STREET_Z.length - 1; iz++) {
      const x0 = STREET_X[ix], x1 = STREET_X[ix + 1], z0 = STREET_Z[iz], z1 = STREET_Z[iz + 1];
      const group = new THREE.Group(); scene.add(group);
      const center = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
      const park = ix === 2 && iz >= 8; const dock = ix === 5 && iz < 2;
      if (park) { this.chunks.push({ group, ...center }); continue; }
      const boxes = [[], [], [], []], trims = [];
      const cols = x1 - x0 > 150 ? 4 : 3;
      for (let bx = 0; bx < cols; bx++) for (let bz = 0; bz < 3; bz++) {
        const x = x0 + 28 + bx * ((x1 - x0 - 56) / (cols - 1));
        const z = z0 + 28 + bz * 32;
        // Keep the main street frontage continuous and the overpass clear.
        if (Math.abs(z - 360) < 27) continue;
        const downtown = x > -300 && z > -250 && z < 290;
        const h = dock ? rng.range(7, 13) : downtown ? rng.range(18, 95) : rng.range(7, 22);
        const w = rng.range(18, cols === 4 ? 24 : 25), d = rng.range(19, 26), style = rng.int(0, 3);
        boxes[style].push({ x, y: h / 2 + .18, z, w, h, d });
        trims.push({ x, y: h + .4, z, w: w + 1.2, h: .8, d: d + 1.2 });
        trims.push({ x, y: .85, z, w: w + .7, h: 1.3, d: d + .7 });
        if (downtown && h > 45) trims.push({ x, y: h + 2.5, z, w: w * .5, h: 4, d: d * .5 });
        collision.add({ x: x - w / 2 - .5, y: 0, z: z - d / 2 - .5 }, { x: x + w / 2 + .5, y: h + .8, z: z + d / 2 + .5 });
        this.count++;
      }
      boxes.forEach((entries, style) => instanceBoxes(group, materials[style], entries));
      instanceBoxes(group, trimMaterial, trims);
      this.chunks.push({ group, ...center });
    }
    this.signs = new THREE.Group(); scene.add(this.signs);
    const signs = [
      ['SOLMAR BAY', 117, -28, 14, '#174d56'], ['PEARL SOCIAL', 112, 94, 5, '#b05c47'],
      ['MIRAGE BANK', -48, 91, 7, '#254b5b'], ['CORAL / COFFEE', 115, -147, 4, '#345f55'],
      ['CINDER LOGISTICS', 108, -506, 6, '#9c5135'], ['ASTER HOTEL', -45, 215, 8, '#234a4f'],
      ['BAYLINE MOTORS', 110, -267, 5, '#184c58'], ['SUNDIAL RECORDS', 112, 212, 4, '#a95871'],
    ];
    for (const [label, x, z, y, color] of signs) {
      const material = new THREE.MeshStandardMaterial({ map: textures.sign(label, color), emissive: '#ead2a2', emissiveIntensity: .17, roughness: .55 });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(label === 'SOLMAR BAY' ? 22 : 14, 3.5), material);
      sign.position.set(x + 14, y, z); sign.rotation.y = Math.PI / 2; this.signs.add(sign);
    }
  }
  update(position, quality = 'med') {
    const radius = quality === 'low' ? 420 : quality === 'ultra' ? 900 : 650;
    for (const chunk of this.chunks) chunk.group.visible = Math.hypot(chunk.x - position.x, chunk.z - position.z) < radius;
  }
}
