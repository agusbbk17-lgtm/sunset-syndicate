import * as THREE from '../../vendor/three.module.min.js';
// A single procedural skeleton supplies every instance; no per-agent scene objects.
export class InstancedModel {
  constructor(scene, template, capacity) {
    this.template = template; this.parts = []; this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    template.root.updateMatrixWorld(true);
    template.root.traverse(part => {
      if (!part.isMesh) return;
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
      for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, this.hidden);
      scene.add(mesh); this.parts.push({ source: part, mesh });
    });
  }
  color(index, material, color) {
    for (const part of this.parts) if (part.source.material === material) part.mesh.setColorAt(index, color);
  }
  write(agent, alpha, visible) {
    if (!agent.active || !visible) {
      for (const part of this.parts) part.mesh.setMatrixAt(agent.id, this.hidden);
      return;
    }
    const root = this.template.root, a = agent.previous, b = agent.position;
    root.position.set(a.x + (b.x - a.x) * alpha, a.y + (b.y - a.y) * alpha, a.z + (b.z - a.z) * alpha);
    root.rotation.set(0, agent.previousHeading + Math.atan2(Math.sin(agent.heading - agent.previousHeading),
      Math.cos(agent.heading - agent.previousHeading)) * alpha, 0);
    root.updateMatrixWorld(true);
    for (const part of this.parts) part.mesh.setMatrixAt(agent.id, part.source.matrixWorld);
  }
  flush() { for (const part of this.parts) part.mesh.instanceMatrix.needsUpdate = true; }
}
