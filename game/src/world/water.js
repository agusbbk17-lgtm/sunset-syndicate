import * as THREE from '../../vendor/three.module.min.js';
export class CoastalWater {
  constructor(scene) {
    this.material = new THREE.MeshStandardMaterial({ color: '#348f9b', metalness: .35, roughness: .22 });
    this.time = { value: 0 };
    this.material.onBeforeCompile = shader => {
      shader.uniforms.waterTime = this.time;
      shader.vertexShader = 'uniform float waterTime; varying vec3 wavePosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed=vec3(position);
        transformed.y+=sin(position.x*.09+waterTime*.7)*.16+sin(position.z*.12+waterTime*.5)*.12;
        wavePosition=transformed;`);
      shader.fragmentShader = 'uniform float waterTime; varying vec3 wavePosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float ripple=pow(max(0.,sin(wavePosition.x*.22+wavePosition.z*.18+waterTime)),18.);
        diffuseColor.rgb+=vec3(.14,.2,.19)*ripple;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.62,.78,.77),pow(1.-abs(dot(normalize(vViewPosition),normal)),4.)*.35);`);
    };
    const geometry = new THREE.PlaneGeometry(1400, 2000, 80, 100); geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, this.material); this.mesh.position.set(950, -.35, 0); scene.add(this.mesh);
  }
  update(dt) { this.time.value += dt; }
}
