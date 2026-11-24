import * as THREE from '../../vendor/three.module.min.js';
import { instanceBoxes, instanceGeometry } from './roads.js';
function palmFrondGeometry() {
  const positions = [], indices = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, width = Math.sin(t * Math.PI) * .5;
    for (const side of [-1, 1]) positions.push(side * width, .28 * Math.sin(t * Math.PI) - t * t * .65, t - .5);
    if (i < 8) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function buildCoastalStreetProps(scene, rng, collision) {
  const trunks = [], leaves = [], lamps = [], bulbs = [], furniture = [], planters = [];
  for (let z = -690; z <= 690; z += 27) for (const x of [139, 184, 217]) {
    const h = rng.range(8, 12);
    trunks.push({ x, y: h / 2, z, w: .36, h, d: .36, yaw: .1 });
    collision.add({ x: x - .25, y: 0, z: z - .25 }, { x: x + .25, y: h, z: z + .25 }, 'palm');
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7 + rng.range(-.2, .2);
      leaves.push({ x: x + Math.sin(angle) * 1.5, y: h - .1, z: z + Math.cos(angle) * 1.5,
        w: 1.2, h: 1.8, d: 5.8, yaw: angle, color: rng.pick(['#3d7554', '#507c55', '#6b8e59']) });
    }
    planters.push({ x, y: .18, z, w: 1.8, h: .36, d: 1.8 });
  }
  // Park groves and residential shade trees use a second low-poly instanced canopy.
  const treeLeaves = [], treeTrunks = [];
  for (let i = 0; i < 100; i++) {
    const x = rng.range(-345, -285), z = rng.range(350, 630), h = rng.range(4, 8);
    treeTrunks.push({ x, y: h / 2, z, w: .4, h, d: .4 });
    treeLeaves.push({ x, y: h + 1, z, w: rng.range(4, 7), h: 4, d: 5, yaw: rng.range(0, 6) });
  }
  for (let z = -690; z < 690; z += 45) for (const x of [136, 187]) {
    lamps.push({ x, y: 3.9, z, w: .13, h: 7.8, d: .13 });
    lamps.push({ x: x + (x < 160 ? 1 : -1), y: 7.8, z, w: 2, h: .16, d: .17 });
    bulbs.push({ x: x + (x < 160 ? 2 : -2), y: 7.7, z, w: .8, h: .12, d: .5 });
    furniture.push({ x: 201, y: .6, z: z + 8, w: 1.7, h: .25, d: .6 });
    furniture.push({ x: 202, y: .92, z: z + 8, w: .16, h: .9, d: 1.7, yaw: Math.PI / 2 });
  }
  instanceGeometry(scene, new THREE.CylinderGeometry(.7, 1, 1, 7), new THREE.MeshStandardMaterial({ color: '#876349', roughness: .95 }), [...trunks, ...treeTrunks]);
  instanceGeometry(scene, palmFrondGeometry(), new THREE.MeshStandardMaterial({ color: '#719266', roughness: .9, side: THREE.DoubleSide }), leaves);
  instanceGeometry(scene, new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshStandardMaterial({ color: '#4d7e54', roughness: .95 }), treeLeaves);
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#e0c4a1', roughness: .9 }), planters);
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#394b50', metalness: .65, roughness: .5 }), lamps);
  const lampMaterial = new THREE.MeshStandardMaterial({ color: '#f7ddb5', emissive: '#ffd798', emissiveIntensity: .8 });
  instanceBoxes(scene, lampMaterial, bulbs, false);
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#a16e50', roughness: .75 }), furniture);
  const dock = [];
  for (let z = -680; z < -560; z += 24) {
    dock.push({ x: 247, y: .8, z, w: 65, h: .8, d: 8 });
    for (const x of [222, 270]) dock.push({ x, y: -.2, z, w: 1.2, h: 3, d: 1.2 });
  }
  instanceBoxes(scene, new THREE.MeshStandardMaterial({ color: '#8a7560', roughness: .9 }), dock);
  return { lampMaterial, palmCount: trunks.length };
}
