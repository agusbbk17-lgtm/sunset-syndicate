import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('/root/makefun-gta6-setup/tooling/browser/node_modules/playwright');
const browser = await chromium.launch({
  executablePath: '/root/makefun-gta6-setup/tooling/browser/browsers/chromium-1255/chrome-linux-arm64/chrome',
  headless: false,
  args: ['--use-angle=gl', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto('http://127.0.0.1:8080/?seed=1&quality=med&noaudio&debug');
  await page.waitForFunction(() => window.__game?.view.stats.webgl2, null, { timeout: 15000 }).catch(async error => {
    console.log({ errors, warnings, bootMessage: await page.locator('#boot-message').textContent() });
    throw error;
  });
  await page.waitForTimeout(2000);
  console.log('Smoke: booted WebGL2; checking walking and camera walls');
  const foundation = await page.evaluate(() => {
    const game = window.__game;
    game.loop.manual = true;
    if (game.ui) game.ui.start(false);
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
    for (let i = 0; i < 600; i++) game.step(1 / 60, false);
    game.input.clear(); game.step(0);
    return { walls: results, walkingMetres: game.player.position.z + 240 };
  });
  assert.ok(foundation.walls.every(result => !result.cameraInside && result.collisionHits > 0), JSON.stringify(foundation));
  assert.ok(foundation.walkingMetres > 35, JSON.stringify(foundation));
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
    for (let i = 0; i < 1800; i++) {
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
    return { ...game.snapshot(), ...game.view.stats, fps: 1000 / game.loop.frameMs,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(warnings.length, 0, warnings.join('\n'));
  assert.ok(result.ticks > 0);
  console.log(JSON.stringify({ ...result, foundation, driving, consoleErrors: errors.length, consoleWarnings: warnings.length }, null, 2));
} finally { await browser.close(); }
