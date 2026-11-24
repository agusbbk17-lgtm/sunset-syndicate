export class CameraDebugOverlay {
  constructor(game) {
    this.game = game; this.element = document.createElement('pre'); this.element.id = 'camera-debug';
    document.getElementById('ui').append(this.element);
  }
  update() {
    const state = this.game.cameraRig.debug, stats = this.game.view.stats;
    this.element.textContent = `WebGL2 · ${this.game.view.quality}\nCamera ${state.mode} / ${state.preset}\nArm ${state.distance.toFixed(2)} m · FOV ${state.fov.toFixed(1)}\nCollision hits ${state.collisionHits}\nDraw calls ${stats.calls} · entities ${this.game.entities.count}/${this.game.entities.budget}`;
  }
}
