import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetEvents } from '../game/src/systems/street-events.js';
import { AgentScheduler } from '../game/src/systems/ai.js';
test('signal rounds consume ammo, alarm the city, reuse the shot ring and expire wanted stars', () => {
  let sound = 0;
  const game = { ai: new AgentScheduler(), audio: { gunshot() { sound++; } }, loop: { time: 0 },
    player: { mode: 'foot', aiming: true, position: { x: 10, z: 20 } }, input: { buttons: new Set([0]), consume: () => false } };
  const events = new StreetEvents(game), ring = game.ai.shots.slice();
  events.update(1 / 60); assert.equal(game.weapons.current.ammo, 23); assert.equal(game.wanted.stars, 1);
  assert.equal(sound, 1); assert.equal(game.ai.shots[0].x, 10);
  for (let i = 0; i < 100; i++) events.gunshot(10 + i, 20);
  assert.equal(game.ai.shots.length, 16); assert.ok(game.ai.shots.every((shot, i) => shot === ring[i]));
  game.input.buttons.clear();
  for (let i = 0; i < 1900; i++) events.update(1 / 60);
  assert.equal(game.wanted.stars, 0); assert.equal(game.subtitle, '');
  events.reset(); assert.equal(game.weapons.current.ammo, 24);
});
