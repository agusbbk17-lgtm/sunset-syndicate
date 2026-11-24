import * as THREE from '../../vendor/three.module.min.js';
import { signalPhase, walkSignal } from './lanes.js';
export class IntersectionSignals {
  constructor(scene, graph) {
    this.graph = graph; this.dummy = new THREE.Object3D(); this.colors = {
      green: new THREE.Color('#65f5a1'), amber: new THREE.Color('#ffc266'), red: new THREE.Color('#f45d55') };
    const count = graph.nodes.length * 4;
    this.poles = new THREE.InstancedMesh(new THREE.BoxGeometry(.16, 4.4, .16), new THREE.MeshStandardMaterial({ color: '#43545a' }), count);
    this.housings = new THREE.InstancedMesh(new THREE.BoxGeometry(.46, 1.1, .32), new THREE.MeshStandardMaterial({ color: '#202e32' }), count);
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.14, 6, 4), new THREE.MeshBasicMaterial({ color: 'white' }), count * 3);
    this.walk = new THREE.InstancedMesh(new THREE.BoxGeometry(.25, .35, .08), new THREE.MeshBasicMaterial({ color: 'white' }), count);
    this.dark = new THREE.Color('#263436'); this.approaches = ['south', 'north', 'west', 'east'];
    for (const node of graph.nodes) for (let side = 0; side < 4; side++) {
      const sx = side === 0 || side === 2 ? 1 : -1, sz = side < 2 ? (side ? 1 : -1) : (side === 2 ? -1 : 1);
      const x = node.x + sx * (node.x === 160 ? 14.5 : 10.5), z = node.z + sz * 10.5, index = node.id * 4 + side;
      this.dummy.rotation.y = side === 0 ? Math.PI : side === 1 ? 0 : side === 2 ? -Math.PI / 2 : Math.PI / 2;
      this.dummy.position.set(x, 2.2, z); this.dummy.updateMatrix(); this.poles.setMatrixAt(index, this.dummy.matrix);
      this.dummy.position.y = 4.1; this.dummy.updateMatrix(); this.housings.setMatrixAt(index, this.dummy.matrix);
      for (let light = 0; light < 3; light++) {
        this.dummy.position.set(x + Math.sin(this.dummy.rotation.y) * .18, 4.43 - light * .33, z + Math.cos(this.dummy.rotation.y) * .18);
        this.dummy.updateMatrix(); this.bulbs.setMatrixAt(index * 3 + light, this.dummy.matrix);
      }
      this.dummy.position.y = 2.8; this.dummy.updateMatrix(); this.walk.setMatrixAt(index, this.dummy.matrix);
    }
    for (const mesh of [this.poles, this.housings, this.bulbs, this.walk]) { mesh.computeBoundingSphere(); scene.add(mesh); }
    this.update(0);
  }
  update(time) {
    for (const node of this.graph.nodes) for (let side = 0; side < 4; side++) {
      const index = node.id * 4 + side, phase = signalPhase(this.graph, node.id, this.approaches[side], time);
      this.bulbs.setColorAt(index * 3, phase === 'red' ? this.colors.red : this.dark);
      this.bulbs.setColorAt(index * 3 + 1, phase === 'amber' ? this.colors.amber : this.dark);
      this.bulbs.setColorAt(index * 3 + 2, phase === 'green' ? this.colors.green : this.dark);
      this.walk.setColorAt(index, walkSignal(this.graph, node.id, time) ? this.colors.green : this.colors.red);
    }
    this.bulbs.instanceColor.needsUpdate = true; this.walk.instanceColor.needsUpdate = true;
  }
}
