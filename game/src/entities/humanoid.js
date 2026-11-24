import * as THREE from '../../vendor/three.module.min.js';
import { damping } from '../core/math.js';
export class ProceduralHumanoid {
  constructor({ jacket = '#d99b66', skin = '#b9825f', trousers = '#263b49' } = {}) {
    this.root = new THREE.Group(); this.root.name = 'player-skeletal-humanoid';
    this.materials = {
      jacket: new THREE.MeshStandardMaterial({ color: jacket, roughness: .82 }),
      skin: new THREE.MeshStandardMaterial({ color: skin, roughness: .9 }),
      trousers: new THREE.MeshStandardMaterial({ color: trousers, roughness: .9 }),
      hair: new THREE.MeshStandardMaterial({ color: '#242326', roughness: .95 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#e6dcc8', roughness: .72 }),
      shirt: new THREE.MeshStandardMaterial({ color: '#f2e8ce', roughness: .86 }),
    };
    this.body = new THREE.Group(); this.root.add(this.body);
    this.torso = this.box(this.body, .47, .57, .25, 0, 1.21, 0, 'jacket');
    this.box(this.body, .22, .43, .018, 0, 1.23, .14, 'shirt');
    this.box(this.body, .35, .2, .23, 0, .86, 0, 'trousers');
    this.box(this.body, .13, .13, .13, 0, 1.56, 0, 'skin');
    this.head = new THREE.Group(); this.head.position.y = 1.68; this.body.add(this.head);
    this.box(this.head, .27, .32, .27, 0, .02, 0, 'skin');
    this.box(this.head, .28, .1, .28, 0, .16, -.025, 'hair');
    this.box(this.head, .27, .18, .07, 0, .04, -.14, 'hair');
    this.box(this.head, .08, .09, .07, 0, 0, .155, 'skin');
    this.arms = []; this.legs = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .29, 1.43, 0); this.body.add(arm);
      this.box(arm, .15, .35, .19, 0, -.16, 0, 'jacket');
      this.box(arm, .12, .29, .14, 0, -.44, .02, 'jacket');
      this.box(arm, .11, .13, .12, 0, -.62, .025, 'skin'); this.arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(side * .13, .86, 0); this.body.add(leg);
      this.box(leg, .18, .43, .2, 0, -.2, 0, 'trousers');
      this.box(leg, .15, .35, .17, 0, -.56, 0, 'trousers');
      this.box(leg, .19, .12, .34, 0, -.8, .08, 'shoe'); this.legs.push(leg);
    }
    this.phase = 0; this.state = 'idle'; this.opacity = 1;
  }
  box(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.materials[material]);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  animate(dt, { speed = 0, sprint = false, crouch = false, grounded = true, aiming = false, driving = false } = {}) {
    this.state = driving ? 'drive' : !grounded ? 'jump' : crouch ? 'crouch' : aiming ? 'aim' : speed > .1 ? sprint ? 'sprint' : 'walk' : 'idle';
    this.phase += dt * (speed > .1 ? 5 + speed * 1.1 : 1.7);
    const stride = Math.min(.8, speed * .12), wave = Math.sin(this.phase);
    for (let i = 0; i < 2; i++) {
      const sign = i ? -1 : 1;
      const legTarget = driving ? -1.25 : grounded ? wave * stride * sign : -.45 * sign;
      const armTarget = aiming ? -1.35 : driving ? -1 : -wave * stride * sign;
      this.legs[i].rotation.x += (legTarget - this.legs[i].rotation.x) * damping(18, dt);
      this.arms[i].rotation.x += (armTarget - this.arms[i].rotation.x) * damping(18, dt);
    }
    this.body.position.y += ((crouch ? -.4 : Math.abs(wave) * stride * .055) - this.body.position.y) * damping(16, dt);
    this.body.rotation.x += ((sprint ? .12 : crouch ? .2 : 0) - this.body.rotation.x) * damping(12, dt);
    this.head.rotation.y = Math.sin(this.phase * .3) * (speed < .1 ? .07 : .015);
  }
  setOpacity(opacity) {
    if (Math.abs(opacity - this.opacity) < .02) return;
    this.opacity = opacity;
    for (const material of Object.values(this.materials)) {
      const transparent = opacity < .99;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = opacity; material.depthWrite = !transparent;
    }
  }
}
