// Core Three.js 0.160.0, pinned and vendored; no examples or external passes.
import * as THREE from '../../vendor/three.module.min.js';
export const QUALITY = {
  low: { ratio: .75, shadows: false, shadowSize: 512, post: false },
  med: { ratio: 1, shadows: true, shadowSize: 1024, post: true },
  high: { ratio: 1.4, shadows: true, shadowSize: 2048, post: true },
  ultra: { ratio: 1.8, shadows: true, shadowSize: 2048, post: true },
};
export class CityRenderer {
  constructor(canvas, quality = 'med') {
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!context) throw new Error('WebGL2 is required. Enable hardware acceleration in your browser.');
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#eeae82');
    this.scene.fog = new THREE.FogExp2('#eab99b', .0016);
    this.camera = new THREE.PerspectiveCamera(60, 1, .08, 2200);
    this.camera.position.set(8, 6, 10);
    this.camera.lookAt(0, 0, 0);
    this.setQuality(quality);
    this.lost = false;
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.lost = true;
      const message = document.getElementById('boot-message');
      message.textContent = 'Rendering paused — restoring WebGL context…';
      message.classList.remove('hidden');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.resize();
      document.getElementById('boot-message').classList.add('hidden');
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  setQuality(name) {
    this.quality = QUALITY[name] ? name : 'med';
    this.settings = { ...QUALITY[this.quality] };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.ratio));
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.resize();
  }
  resize() {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.post?.resize(width, height, this.renderer.getPixelRatio());
  }
  render(dt, time) {
    if (this.lost) return;
    if (this.post && this.settings.post) this.post.render(this.scene, this.camera, time);
    else this.renderer.render(this.scene, this.camera);
  }
  get stats() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, webgl2: true }; }
}
