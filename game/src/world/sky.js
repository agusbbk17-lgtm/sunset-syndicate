import * as THREE from '../../vendor/three.module.min.js';
export class SolmarSky {
  constructor(scene, quality) {
    this.timeOfDay = 17.2;
    this.sunDirection = new THREE.Vector3(-.65, .38, .6).normalize();
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { sunDirection: { value: this.sunDirection }, night: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 direction;void main(){direction=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
      fragmentShader: `
        varying vec3 direction; uniform vec3 sunDirection; uniform float night; uniform float time;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          vec3 d=normalize(direction); float h=max(d.y,0.);
          vec3 day=mix(vec3(1.,.68,.43),vec3(.24,.51,.72),pow(h,.45));
          float sun=dot(d,sunDirection); day+=vec3(1.,.58,.23)*pow(max(sun,0.),48.)*.36;
          day+=vec3(1.,.9,.62)*smoothstep(.9993,.9998,sun)*3.;
          float clouds=sin(d.x*28.+time*.004)*sin(d.z*25.)+sin(d.x*67.+d.z*40.);
          day=mix(day,vec3(.98,.83,.72),smoothstep(1.1,1.7,clouds)*smoothstep(.04,.2,h)*.36);
          vec3 dark=mix(vec3(.07,.06,.15),vec3(.015,.055,.12),h);
          float stars=step(.997,hash(floor(d.xz*700.)))*smoothstep(.1,.4,h);
          gl_FragColor=vec4(mix(day,dark+stars,night),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -100; scene.add(this.mesh);
    this.hemisphere = new THREE.HemisphereLight('#b6d4e6', '#916d4c', 1.5); scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight('#ffd5a1', 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 250 });
    this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .025;
    scene.add(this.sun, this.sun.target);
    this.scene = scene;
  }
  update(dt, player, frozen = false) {
    if (!frozen) this.timeOfDay = (this.timeOfDay + dt / 50) % 24;
    const night = this.timeOfDay >= 19.5 || this.timeOfDay < 6 ? 1 : 0;
    this.material.uniforms.night.value = night;
    this.material.uniforms.time.value += dt;
    this.sun.intensity = night ? .24 : 3.2; this.hemisphere.intensity = night ? .42 : 1.5;
    this.sun.color.set(night ? '#aec6ed' : '#ffd5a1');
    this.scene.fog.color.set(night ? '#182a41' : '#eab99b');
    const x = Math.round(player.x / 4) * 4, z = Math.round(player.z / 4) * 4;
    this.sun.position.set(x - 90, 90, z + 85); this.sun.target.position.set(x, 0, z);
    this.mesh.position.set(player.x, 0, player.z);
  }
}
