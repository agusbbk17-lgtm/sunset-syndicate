import * as THREE from '../../vendor/three.module.min.js';
// One original film pass: luminance bloom, edge occlusion, vignette and light grain.
export class CoastalPostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.scene = new THREE.Scene(); this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: { image: { value: this.target.texture }, texel: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, strength: { value: 1 } },
      vertexShader: `varying vec2 uvFilm; void main(){uvFilm=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `
        uniform sampler2D image; uniform vec2 texel; uniform float time; uniform float strength;
        varying vec2 uvFilm;
        float luminance(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
        void main(){
          vec3 c=texture2D(image,uvFilm).rgb;
          vec3 bloom=vec3(0.); float edge=0.;
          for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){
            vec3 sampleColor=texture2D(image,uvFilm+vec2(float(x),float(y))*texel*2.).rgb;
            bloom+=sampleColor*max(0.,luminance(sampleColor)-.72)/25.;
            edge+=max(0.,luminance(c)-luminance(sampleColor))/25.;
          }
          c+=bloom*.16*strength; c*=1.-min(.1,edge*.15)*strength;
          vec2 p=uvFilm-.5; float vignette=1.-dot(p,p)*.36;
          float grain=fract(sin(dot(uvFilm*vec2(1280.,720.),vec2(12.9898,78.233))+floor(time*24.))*43758.5453)-.5;
          c=c*vignette+grain*.003*strength;
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }
  resize(width, height, ratio) {
    this.target.setSize(Math.round(width * ratio), Math.round(height * ratio));
    this.material.uniforms.texel.value.set(1 / (width * ratio), 1 / (height * ratio));
  }
  render(scene, camera, time) {
    this.material.uniforms.time.value = time;
    this.renderer.setRenderTarget(this.target); this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.camera);
  }
}
