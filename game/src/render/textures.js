import * as THREE from '../../vendor/three.module.min.js';
export class ProceduralTextures {
  constructor(rng) { this.rng = rng; this.cache = new Map(); }
  canvas(name, width, height, draw) {
    if (this.cache.has(name)) return this.cache.get(name);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d', { willReadFrequently: true }), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.cache.set(name, texture);
    return texture;
  }
  asphalt() {
    const texture = this.canvas('asphalt', 256, 256, (ctx, w, h) => {
      // The map carries the road's own tone: the material that uses it stays near white,
      // otherwise colour and map multiply and the surface reads as black under ACES.
      ctx.fillStyle = '#767e83'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const tone = this.rng.int(96, 168); ctx.fillStyle = `rgba(${tone},${tone},${tone},.26)`;
        ctx.fillRect(this.rng.int(0, w), this.rng.int(0, h), 1, 1);
      }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(35, 35);
    return texture;
  }
  facade(style) {
    return this.canvas(`facade-${style}`, 256, 512, (ctx, w, h) => {
      const colors = ['#c7b8a4', '#708d96', '#d5c9b5', '#958880'];
      ctx.fillStyle = colors[style]; ctx.fillRect(0, 0, w, h);
      for (let y = 8; y < h; y += 32) for (let x = 7; x < w; x += 32) {
        ctx.fillStyle = '#293e48'; ctx.fillRect(x, y, 20, 24);
        const lit = this.rng.next() < .18;
        ctx.fillStyle = lit ? '#edc18b' : this.rng.pick(['#54767d', '#74919a', '#415c69']);
        ctx.fillRect(x + 2, y + 2, 16, 19);
        ctx.fillStyle = 'rgba(230,241,238,.24)'; ctx.fillRect(x + 2, y + 2, 7, 19);
        ctx.fillStyle = '#bbc1ba'; ctx.fillRect(x - 1, y + 25, 22, 2);
      }
    });
  }
  sign(label, background = '#1b5557', foreground = '#ffe4ad') {
    return this.canvas(`sign-${label}`, 512, 128, (ctx, w, h) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = foreground; ctx.lineWidth = 4; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${label.length > 16 ? 30 : 40}px Arial`; ctx.fillText(label, w / 2, h / 2, w - 34);
    });
  }
}
