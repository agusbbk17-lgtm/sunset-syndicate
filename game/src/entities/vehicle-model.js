import * as THREE from '../../vendor/three.module.min.js';
// Shared geometry recipes remain accessible to a later instanced traffic renderer.
function sectionalBody(sections) {
  const positions = [], indices = [];
  for (const [z, width, bottom, top] of sections) positions.push(-width, bottom, z, width, bottom, z, width, top, z, -width, top, z);
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < 4; j++) {
    const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = a + 4, d = b + 4;
    indices.push(a, b, c, b, d, c);
  }
  indices.push(0, 3, 2, 0, 2, 1);
  const end = (sections.length - 1) * 4; indices.push(end, end + 1, end + 2, end, end + 2, end + 3);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export class ProceduralVehicleModel {
  constructor(type, spec, color = spec.color) {
    this.root = new THREE.Group(); this.root.name = `vehicle-${type}-${spec.name}`;
    this.chassis = new THREE.Group(); this.root.add(this.chassis); this.wheels = [];
    this.paint = new THREE.MeshPhysicalMaterial({ color, metalness: .65, roughness: .25, clearcoat: 1, clearcoatRoughness: .16 });
    this.glass = new THREE.MeshPhysicalMaterial({ color: '#183947', metalness: .3, roughness: .14, clearcoat: 1 });
    this.trim = new THREE.MeshStandardMaterial({ color: '#1c252b', roughness: .55, metalness: .25 });
    this.chrome = new THREE.MeshStandardMaterial({ color: '#c0cdd0', metalness: .9, roughness: .23 });
    this.tyre = new THREE.MeshStandardMaterial({ color: '#1b2024', roughness: .9 });
    this.headlights = new THREE.MeshStandardMaterial({ color: '#e6f4e8', emissive: '#ffe4b3', emissiveIntensity: .4 });
    this.taillights = new THREE.MeshStandardMaterial({ color: '#b51f31', emissive: '#f52d32', emissiveIntensity: .6 });
    this.spec = spec; this.type = type;
    const length = spec.length, width = spec.width;
    if (type === 'bike') this.buildBike();
    else {
      const profile = [[-length / 2, width * .43, .38, .68], [-length * .32, width * .5, .32, .84],
        [length * .3, width * .49, .32, .79], [length / 2, width * .43, .4, .61]];
      this.add(this.chassis, sectionalBody(profile), this.paint);
      const cabinFront = type === 'pickup' ? .25 : .5, cabinBack = type === 'sports' ? -.6 : -.85;
      const roofHeight = spec.height;
      const roof = sectionalBody([[cabinBack - .5, width * .41, .76, .84], [cabinBack, width * .35, .8, roofHeight],
        [cabinFront, width * .35, .8, roofHeight], [cabinFront + .65, width * .42, .76, .84]]);
      this.add(this.chassis, roof, this.glass);
      this.box(this.chassis, width * .7, .055, cabinFront - cabinBack + .06, 0, roofHeight + .02, (cabinBack + cabinFront) / 2, this.paint);
      for (const side of [-1, 1]) {
        this.box(this.chassis, .06, roofHeight - .81, .09, side * width * .36, (roofHeight + .8) / 2, -.2, this.trim);
        this.box(this.chassis, .19, .13, .3, side * (width / 2 + .075), .95, .4, this.paint);
        this.box(this.chassis, .06, .05, .28, side * (width / 2 + .015), .75, -.1, this.chrome);
        this.box(this.chassis, width * .28, .13, .08, side * width * .28, .63, length / 2 + .015, this.headlights);
        this.box(this.chassis, width * .3, .12, .07, side * width * .27, .64, -length / 2 - .015, this.taillights);
      }
      this.box(this.chassis, width * .38, .17, .05, 0, .46, length / 2 + .025, this.trim);
      this.box(this.chassis, .4, .13, .03, 0, .49, -length / 2 - .055, this.chrome);
      for (const z of [-length / 2, length / 2]) this.box(this.chassis, width * .94, .12, .13, 0, .36, z, this.trim);
      if (type === 'sports' || type === 'muscle') {
        this.box(this.chassis, width * .8, .07, .25, 0, .93, -length * .4, this.trim);
        for (const side of [-1, 1]) this.box(this.chassis, .11, .16, .13, side * .55, .84, -length * .4, this.trim);
      }
      if (type === 'pickup') this.box(this.chassis, width * .77, .03, 1.8, 0, .84, -1.35, this.trim);
      if (type === 'police') {
        this.box(this.chassis, width * .69, .08, .32, 0, roofHeight + .09, -.2, this.trim);
        this.lightbarRed = new THREE.MeshStandardMaterial({ color: '#e7344c', emissive: '#ff1538', emissiveIntensity: 2 });
        this.lightbarBlue = new THREE.MeshStandardMaterial({ color: '#2671eb', emissive: '#1679ff', emissiveIntensity: 2 });
        this.box(this.chassis, .55, .13, .25, -.4, roofHeight + .18, -.2, this.lightbarRed);
        this.box(this.chassis, .55, .13, .25, .4, roofHeight + .18, -.2, this.lightbarBlue);
      }
      if (type === 'taxi') this.box(this.chassis, .6, .23, .25, 0, roofHeight + .13, -.1, this.headlights);
      for (const side of [-1, 1]) for (const axle of [-1, 1]) this.wheel(side * (width / 2 - .06), .39, axle * length * .31, .38, .23, axle === 1);
    }
  }
  add(parent, geometry, material) {
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  box(parent, w, h, d, x, y, z, material) {
    const mesh = this.add(parent, new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); return mesh;
  }
  wheel(x, y, z, radius, thickness, front) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); this.root.add(pivot);
    const rubber = this.add(pivot, new THREE.CylinderGeometry(radius, radius, thickness, 16), this.tyre); rubber.rotation.z = Math.PI / 2;
    const rim = this.add(pivot, new THREE.CylinderGeometry(radius * .64, radius * .64, thickness + .015, 10), this.chrome); rim.rotation.z = Math.PI / 2;
    this.wheels.push({ pivot, front, radius });
  }
  buildBike() {
    this.box(this.chassis, .4, .4, .85, 0, .78, .1, this.paint);
    this.box(this.chassis, .46, .12, .7, 0, 1.04, -.38, this.trim);
    this.box(this.chassis, .14, .55, .13, 0, .77, .83, this.chrome);
    this.box(this.chassis, .78, .08, .1, 0, 1.12, .67, this.chrome);
    this.box(this.chassis, .24, .16, .14, 0, 1.01, .83, this.headlights);
    this.wheel(0, .36, .85, .36, .15, true); this.wheel(0, .36, -.85, .36, .2, false);
  }
  animate(dt, car, time) {
    this.chassis.rotation.z = this.type === 'bike' ? -car.steer * Math.abs(car.speed) * .018 : car.roll;
    this.chassis.rotation.x = car.pitch;
    this.chassis.position.y = Math.sin(time * 12) * Math.min(.015, Math.abs(car.speed) * .001);
    for (const wheel of this.wheels) { wheel.pivot.rotation.x += car.speed * dt / wheel.radius; if (wheel.front) wheel.pivot.rotation.y = car.steer * .38; }
    this.headlights.emissiveIntensity = car.lights ? 2 : .4;
    this.taillights.emissiveIntensity = car.braking ? 3 : .6;
  }
}
