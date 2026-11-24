export class AdaptiveQualityGovernor {
  constructor(view, enabled = true) { this.view = view; this.enabled = enabled; this.slowSeconds = 0; this.stage = 0; this.averageMs = 16.7; }
  reset() { this.stage = 0; this.slowSeconds = 0; this.averageMs = 16.7; }
  update(frameDt) {
    if (!this.enabled || frameDt <= 0) return;
    this.averageMs += (Math.min(frameDt, .25) * 1000 - this.averageMs) * .03;
    this.slowSeconds = this.averageMs > 20 ? this.slowSeconds + Math.min(frameDt, .25) : Math.max(0, this.slowSeconds - frameDt);
    if (this.slowSeconds < 5) return;
    this.slowSeconds = 0; const renderer = this.view.renderer;
    if (this.stage === 0) { renderer.setPixelRatio(Math.max(.65, renderer.getPixelRatio() * .8)); this.view.resize(); }
    if (this.stage === 1) { renderer.shadowMap.enabled = false; this.view.settings.shadows = false; }
    if (this.stage === 2) this.view.settings.post = false;
    this.stage = Math.min(3, this.stage + 1);
  }
}
