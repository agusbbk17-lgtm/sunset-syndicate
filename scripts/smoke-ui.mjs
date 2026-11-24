import assert from 'node:assert/strict';
export async function checkInterface(page) {
  // Timestamped bridge: every round trip into the page is logged, so a slow software
  // rasteriser can be told apart from a real hang.
  let last = Date.now();
  const stamp = label => {
    const now = Date.now();
    console.log(`[ui] ${label} +${((now - last) / 1000).toFixed(1)}s`);
    last = now;
  };
  const short = fn => (fn.name || String(fn).replace(/\s+/g, ' ')).slice(0, 44);
  const raw = {
    evaluate: page.evaluate.bind(page),
    waitForFunction: page.waitForFunction.bind(page),
    press: page.keyboard.press.bind(page.keyboard),
  };
  page.evaluate = async (fn, arg) => { const result = await raw.evaluate(fn, arg); stamp(`eval ${short(fn)}`); return result; };
  page.waitForFunction = async (fn, arg, options) => { const result = await raw.waitForFunction(fn, arg, options); stamp(`wait ${short(fn)}`); return result; };
  page.keyboard.press = async key => { const result = await raw.press(key); stamp(`key ${key}`); return result; };
  const click = selector => page.evaluate(selector => document.querySelector(selector).click(), selector);
  const value = (id, value) => page.evaluate(({ id, value }) => {
    const field = document.getElementById(`setting-${id}`);
    if (field.type === 'checkbox') field.checked = value; else field.value = String(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, value });
  assert.equal(await page.evaluate(() => !document.getElementById('hud').hidden), true);
  console.log('Smoke UI: pause');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.ui.screen === 'pause');
  const pausedTicks = await page.evaluate(() => window.__game.loop.ticks);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.__game.loop.ticks), pausedTicks);
  console.log('Smoke UI: settings');
  await click('#screen-pause [data-action="settings"]');
  for (const [id, setting] of [['quality', 'low'], ['fov', 72], ['sensitivity', 1.4], ['volume', .25], ['engineVolume', .3], ['camera', 2], ['reduceMotion', true]]) await value(id, setting);
  const settings = await page.evaluate(() => ({ ...window.__game.settings, ratio: window.__game.view.renderer.getPixelRatio(),
    preset: window.__game.cameraRig.preset, master: window.__game.audio.master.gain.value }));
  assert.equal(settings.fov, 72); assert.equal(settings.sensitivity, 1.4); assert.equal(settings.preset, 2);
  assert.equal(settings.reduceMotion, true); assert.equal(settings.volume, .25); assert.equal(settings.quality, 'low');
  // The quality slider is verified by the snapshot above. This run stays on the cheapest
  // preset here; the four presets are rebuilt and rendered in the dedicated sweep phase.
  await value('reduceMotion', false);
  await click('#screen-settings [data-action="back"]');
  await click('#screen-pause [data-action="map"]');
  console.log('Smoke UI: map');
  await page.evaluate(() => {
    const canvas = document.getElementById('full-map'), box = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: box.x + box.width * .5, clientY: box.y + box.height * .65 }));
  });
  const waypoint = await page.evaluate(() => ({ point: window.__game.waypoint, edges: window.__game.hud.minimap.route.length }));
  assert.ok(waypoint.point && waypoint.edges > 0, JSON.stringify(waypoint));
  await page.keyboard.press('KeyM'); await page.waitForFunction(() => window.__game.ui.screen === 'playing');
  await page.waitForFunction(() => document.getElementById('objective-distance').textContent.includes('M'));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__game.ui.screen === 'pause');
  await click('#screen-pause [data-action="save"]');
  assert.equal(await page.evaluate(() => document.getElementById('save-notice').textContent), 'PROGRESS SAVED');
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('sunset-syndicate-v1')).data.position.length === 3));
  await click('#screen-pause [data-action="main"]'); await click('#continue-button');
  await page.waitForFunction(() => window.__game.ui.screen === 'playing');
  const audio = await page.evaluate(() => {
    const game = window.__game; game.player.vehicle.rpm = 4200; game.audio.update(0);
    return { ...game.audio.debug, voices: game.audio.oscillators.length, ambience: !!game.audio.ambienceFilter,
      squeal: !!game.audio.squeal, step: !!game.audio.stepVoice };
  });
  assert.equal(audio.started, true); assert.equal(audio.frequency, 140); assert.equal(audio.voices, 3);
  assert.ok(audio.blips > 0 && audio.ambience && audio.squeal && audio.step);
  console.log('Smoke: interface, persistence and WebAudio', JSON.stringify({ settings, waypoint, audio }));
  return { settings, waypoint, audio };
}
