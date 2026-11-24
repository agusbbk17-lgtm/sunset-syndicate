import * as THREE from '../../vendor/three.module.min.js';
export function terrainHeight(x, z) {
  const hills = Math.max(0, (-x - 520) / 220);
  return hills * hills * (22 + 12 * Math.sin(z * .006)) - .02;
}
export function buildCoastalTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(1000, 1500, 64, 96); geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) - 250, z = positions.getZ(i);
    positions.setXYZ(i, x, terrainHeight(x, z) - .08, z);
  }
  geometry.computeVertexNormals();
  const land = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#849278', roughness: 1 }));
  land.receiveShadow = true; scene.add(land);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 1500), new THREE.MeshStandardMaterial({ color: '#e0c49b', roughness: .95 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(220, -.01, 0); sand.receiveShadow = true; scene.add(sand);
  return { heightAt: terrainHeight };
}
