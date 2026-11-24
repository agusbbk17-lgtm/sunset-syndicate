// Repeatable shot poses, extended by later systems through registerPose/registerHook.
export class DeterministicShotDirector {
  constructor(game) { this.game = game; this.poses = new Map(); this.hooks = []; this.name = null; this.settleTicks = 90; }
  registerPose(name, setup) { this.poses.set(name, setup); }
  registerHook(setup) { this.hooks.push(setup); }
  seek(name) {
    const game = this.game;
    this.name = name; game.shotReady = false; game.loop.manual = true;
    const pose = this.poses.get(name) || this.poses.get('onfoot');
    pose?.(game);
    for (const hook of this.hooks) hook(name, game);
    game.input.clear(); game.cameraRig.reset(game.player);
    for (let i = 0; i < this.settleTicks; i++) game.step(1 / 60, false);
    game.step(0);
    game.loop.paused = true; game.shotReady = true;
  }
}
