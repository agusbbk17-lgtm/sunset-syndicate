// Repeatable shot poses, extended by later systems through registerPose/registerHook.
export class DeterministicShotDirector {
  constructor(game) { this.game = game; this.poses = new Map(); this.hooks = []; this.name = null; this.settleTicks = 90; }
  registerPose(name, setup) { this.poses.set(name, setup); }
  registerHook(setup) { this.hooks.push(setup); }
  seek(name) {
    const game = this.game;
    this.name = name; game.shotReady = false; game.loop.manual = true;
    game.ui?.show('playing');
    game.loop.time = 0; game.loop.ticks = 0; game.loop.accumulator = 0;
    game.backdropTime = 0; game.backdropAccumulator = 0;
    game.world.water.time.value = 0; game.world.sky.material.uniforms.time.value = 0;
    game.player.humanoid.phase = 0;
    game.player.crouch = false; game.player.aiming = false; game.player.sprint = false; game.player.grounded = true;
    game.player.health = 100; game.player.armour = 50; game.player.cash = 250;
    game.cameraRig.fov = game.settings.fov; game.cameraRig.aimBlend = 0; game.cameraRig.lookIdle = 0;
    game.cameraRig.shoulder = 1; game.cameraRig.setPreset(1);
    game.vehicleCinematic.elapsed = 0; game.vehicleCinematic.cut = 0;
    for (const limb of [...game.player.humanoid.arms, ...game.player.humanoid.legs]) limb.rotation.set(0, 0, 0);
    game.player.humanoid.body.position.set(0, 0, 0); game.player.humanoid.body.rotation.set(0, 0, 0);
    game.vehicles.transition = null;
    game.heroCar.position.set(153, .15, -105); game.heroCar.previous.copy(game.heroCar.position);
    game.heroCar.heading = 0; game.heroCar.previousHeading = 0;
    for (const car of game.vehicles.cars) {
      car.velocity.set(0, 0, 0); car.speed = 0; car.steer = 0; car.roll = 0; car.pitch = 0; car.rpm = 850;
      car.controls = { throttle: 0, brake: 0, steer: 0 };
      for (const wheel of car.model.wheels) wheel.pivot.rotation.set(0, 0, 0);
    }
    const pose = this.poses.get(name) || this.poses.get('onfoot');
    pose?.(game);
    for (const hook of this.hooks) hook(name, game);
    game.input.clear(); game.cameraRig.reset(game.player);
    for (let i = 0; i < this.settleTicks; i++) game.step(1 / 60, false);
    game.step(0);
    game.loop.paused = true; game.shotReady = true;
  }
}
