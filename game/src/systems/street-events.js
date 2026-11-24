// Signal rounds make noise and alarm residents; this is not a damage-combat system.
export class StreetEvents {
  constructor(game) {
    this.game = game; this.cooldown = 0; this.quiet = 0; this.subtitleTime = 0;
    game.weapons = { current: { name: 'Harbor Signal', ammo: 24 } };
    game.wanted = { level: 0, stars: 0, searching: false };
  }
  gunshot(x, z) {
    const game = this.game;
    game.ai.gunshot(x, z, game.loop.time); game.audio.gunshot();
  }
  update(dt) {
    const game = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt); this.quiet += dt;
    if (this.subtitleTime > 0) {
      this.subtitleTime -= dt; if (this.subtitleTime <= 0) game.subtitle = '';
    }
    if (game.input.consume('KeyR')) game.weapons.current.ammo = 24;
    if (game.player.mode === 'foot' && game.player.aiming && game.input.buttons.has(0) &&
      this.cooldown === 0 && game.weapons.current.ammo > 0) {
      this.cooldown = .35; game.weapons.current.ammo--; this.quiet = 0;
      this.gunshot(game.player.position.x, game.player.position.z);
      game.wanted.level = Math.min(3, game.wanted.level + 1); game.wanted.stars = game.wanted.level;
      game.subtitle = 'The streets heard that. Give the residents some space.'; this.subtitleTime = 2.5;
    }
    if (this.quiet > 30 && game.wanted.level > 0) {
      game.wanted.level--; game.wanted.stars = game.wanted.level; this.quiet = 0;
    }
  }
  reset() {
    this.cooldown = 0; this.quiet = 0; this.subtitleTime = 0;
    this.game.wanted.level = this.game.wanted.stars = 0; this.game.weapons.current.ammo = 24; this.game.subtitle = '';
  }
}
