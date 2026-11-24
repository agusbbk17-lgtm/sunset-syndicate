import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { checkInterface } from './smoke-ui.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/root/makefun-gta6-setup/tooling/browser/node_modules/playwright');
const browser = await chromium.launch({
  executablePath: '/root/makefun-gta6-setup/tooling/browser/browsers/chromium-1255/chrome-linux-arm64/chrome',
  headless: false,
  env: { ...process.env, LP_NUM_THREADS: '2' },
  args: ['--use-angle=gl', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--renderer-process-limit=1'],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  // Main-world polling avoids dependence on the compositor and isolated-world injection.
  page.waitForFunction = async (fn, arg, options = {}) => {
    const deadline = performance.now() + (options.timeout || 30000);
    while (performance.now() < deadline) {
      if (await page.evaluate(fn, arg)) return;
      await page.waitForTimeout(100);
    }
    throw new Error('Smoke condition timed out');
  };
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') { errors.push(message.text()); console.log('Browser error:', message.text()); }
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto('http://127.0.0.1:8080/?seed=1&quality=low&debug', { timeout: 90000 });
  await page.waitForFunction(() => window.__game?.view.stats.webgl2, null, { timeout: 15000 }).catch(async error => {
    console.log({ errors, warnings, bootMessage: await page.evaluate(() => document.getElementById('boot-message').textContent) });
    throw error;
  });
  await page.evaluate(() => {
    const game = window.__game;
    if (game.autoQuality) game.autoQuality.enabled = false;
  });
  async function assertLive(screen) {
    const samples = [];
    for (let i = 0; i <= 4; i++) {
      if (i) await page.waitForTimeout(500);
      samples.push(await page.evaluate(() => ({ frames: window.__game.loop.frames, screen: window.__game.ui.screen,
        water: window.__game.world.water.time.value, ticks: window.__game.loop.ticks })));
    }
    assert.ok(samples.every(sample => sample.screen === screen), JSON.stringify(samples));
    for (let i = 1; i < samples.length; i++) assert.ok(samples[i].frames > samples[i - 1].frames, JSON.stringify(samples));
    if (screen === 'main') {
      assert.equal(samples[0].ticks, samples[4].ticks); assert.ok(samples[4].water > samples[0].water);
    }
    return samples;
  }
  const menuFrames = await assertLive('main');
  console.log('Smoke: live main menu', JSON.stringify(menuFrames));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.audio.started && window.__game.ui.screen === 'playing');
  const playingFrames = await assertLive('playing');
  console.log('Smoke: live gameplay', JSON.stringify(playingFrames));
  const frameStart = await page.evaluate(() => ({ frames: window.__game.loop.frames, ticks: window.__game.loop.ticks, time: performance.now() }));
  await page.waitForTimeout(4000);
  const frameEnd = await page.evaluate(() => ({ frames: window.__game.loop.frames, ticks: window.__game.loop.ticks, time: performance.now() }));
  const measuredFps = (frameEnd.frames - frameStart.frames) * 1000 / (frameEnd.time - frameStart.time);
  const interfaceResult = await checkInterface(page);
  console.log('Smoke: booted WebGL2; checking walking and camera walls');
  const foundation = await page.evaluate(() => {
    const game = window.__game;
    game.loop.manual = true;
    if (game.ui) game.ui.start(false);
    if (game.player.vehicle) game.player.vehicle.driver = null;
    game.player.vehicle = null; game.player.mode = 'foot';
    const results = [];
    const wall = game.world.collision.boxes.find(box => box.tag === 'building' && box.min.x > -200 && box.max.x < 100);
    for (let preset = 0; preset < 3; preset++) {
      game.player.teleport(wall.max.x + .38, .15, (wall.min.z + wall.max.z) / 2, Math.PI / 2);
      game.cameraRig.reset(game.player); game.cameraRig.setPreset(preset);
      for (let i = 0; i < 120; i++) game.step(1 / 60, false);
      game.step(0);
      results.push({ preset, collisionHits: game.cameraRig.collisionHits,
        cameraInside: game.world.collision.inside(game.view.camera.position, .2) });
    }
    game.player.teleport(-20, .15, -240, 0); game.cameraRig.reset(game.player);
    game.input.keys.add('KeyW');
    for (let i = 0; i < 480; i++) game.step(1 / 60, false);
    game.input.clear(); game.step(0);
    return { walls: results, walkingMetres: game.player.position.z + 240 };
  });
  assert.ok(foundation.walls.every(result => !result.cameraInside && result.collisionHits > 0), JSON.stringify(foundation));
  assert.ok(foundation.walkingMetres > 30, JSON.stringify(foundation));
  console.log('Smoke: camera and walking', JSON.stringify(foundation));
  const driving = await page.evaluate(() => {
    const game = window.__game;
    if (!game.vehicles) return null;
    game.cameraRig.cinematic = false;
    game.player.teleport(149, .15, -105, 0); game.cameraRig.reset(game.player);
    game.step(1 / 60, false);
    const transitions = []; let maxCameraJump = 0, cameraInside = 0;
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const expected of ['driving', 'foot']) {
        const started = game.vehicles.interact();
        for (let i = 0; i < 30; i++) {
          const before = game.cameraRig.position.clone(); game.step(1 / 60, false);
          maxCameraJump = Math.max(maxCameraJump, before.distanceTo(game.cameraRig.position));
          if (game.world.collision.inside(game.cameraRig.position, .2)) cameraInside++;
        }
        transitions.push({ started, expected, actual: game.player.mode });
      }
    }
    game.vehicles.interact();
    for (let i = 0; i < 30; i++) game.step(1 / 60, false);
    const startZ = game.player.position.z;
    game.input.keys.add('KeyW');
    for (let i = 0; i < 1320; i++) {
      game.step(1 / 60, false);
      if (game.world.collision.inside(game.cameraRig.position, .2)) cameraInside++;
    }
    game.input.clear(); game.step(0);
    return { transitions, maxCameraJump, cameraInside, metres: game.player.position.z - startZ,
      finalSpeed: game.player.vehicle?.speed, gear: game.player.vehicle?.gear, rpm: game.player.vehicle?.rpm };
  });
  if (driving) {
    assert.ok(driving.transitions.every(result => result.started && result.actual === result.expected), JSON.stringify(driving));
    assert.ok(driving.maxCameraJump < 1 && driving.cameraInside === 0 && driving.metres > 300, JSON.stringify(driving));
    console.log('Smoke: vehicle route and transitions', JSON.stringify(driving));
  }
  for (const quality of ['low', 'med', 'high', 'ultra']) {
    await page.evaluate(quality => { window.__game.view.setQuality(quality); window.__game.step(0); }, quality);
    await page.waitForTimeout(400);
    console.log(`Smoke: quality ${quality} rendered`);
  }
  const result = await page.evaluate(() => {
    const game = window.__game;
    const gl = game.view.renderer.getContext();
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { ...game.snapshot(), ...game.view.stats,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(warnings.length, 0, warnings.join('\n'));
  assert.ok(result.ticks > 0);
  assert.equal(await page.evaluate(() => window.__game.loop.errors), 0);
  console.log(JSON.stringify({ ...result, foundation, driving, interfaceResult, menuFrames, playingFrames, measuredFps,
    realtimeTicks: frameEnd.ticks - frameStart.ticks, realtimeSeconds: (frameEnd.time - frameStart.time) / 1000,
    consoleErrors: errors.length, consoleWarnings: warnings.length }, null, 2));
} finally { await browser.close(); }
