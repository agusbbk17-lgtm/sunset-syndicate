import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveQualityGovernor } from '../game/src/render/auto-quality.js';
test('sustained slow frames lower ratio, then shadows, then post; fast and disabled frames do not', () => {
  const renderer = { ratio: 1, shadowMap: { enabled: true }, getPixelRatio() { return this.ratio; }, setPixelRatio(value) { this.ratio = value; } };
  const view = { renderer, settings: { shadows: true, post: true }, resize() {} };
  const governor = new AdaptiveQualityGovernor(view);
  for (let i = 0; i < 600; i++) governor.update(1 / 60);
  assert.equal(governor.stage, 0);
  while (governor.stage < 1) governor.update(.03);
  assert.equal(renderer.ratio, .8); assert.equal(renderer.shadowMap.enabled, true);
  while (governor.stage < 2) governor.update(.03);
  assert.equal(renderer.shadowMap.enabled, false); assert.equal(view.settings.post, true);
  while (governor.stage < 3) governor.update(.03);
  assert.equal(view.settings.post, false);
  governor.reset(); governor.enabled = false;
  for (let i = 0; i < 1000; i++) governor.update(.1);
  assert.equal(governor.stage, 0);
});
