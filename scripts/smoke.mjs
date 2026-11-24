import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { checkInterface } from './smoke-ui.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/root/makefun-gta6-setup/tooling/browser/node_modules/playwright');
// This container rasterises in software (llvmpipe), so the smoke run is driven at a
// small viewport and every phase is timestamped.
const VIEWPORT = { width: Number(process.env.SMOKE_W || 640), height: Number(process.env.SMOKE_H || 360) };
// SMOKE_RENDER names the single preset that pays for a real GPU frame in the sweep
// phase. Switching this rasteriser onto the shadowed pipeline costs about sixteen
// seconds once, so the default keeps the cheapest preset and the other three quality
// levels are verified structurally instead.
const SWEEP = (process.env.SMOKE_RENDER || 'low').split(',');
const PRESETS = ['low', 'med', 'high', 'ultra'];
assert.ok(SWEEP.length === 1 && PRESETS.includes(SWEEP[0]), 'SMOKE_RENDER must name exactly one of low, med, high, ultra');
const bootAt = Date.now();
let lastMark = bootAt;
const mark = label => {
  const now = Date.now();
  console.log(`[phase] ${label}: +${((now - lastMark) / 1000).toFixed(1)}s (total ${((now - bootAt) / 1000).toFixed(1)}s)`);
  lastMark = now;
};
const browser = await chromium.launch({
  executablePath: '/root/makefun-gta6-setup/tooling/browser/browsers/chromium-1255/chrome-linux-arm64/chrome',
  headless: false,
  env: { ...process.env, LP_NUM_THREADS: '2' },
  args: ['--use-angle=gl', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--renderer-process-limit=1'],
});
try {
  const page = await browser.newPage({ viewport: VIEWPORT });
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
  mark('webgl2 boot');
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
  mark('main menu live');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.audio.started && window.__game.ui.screen === 'playing');
  const playingFrames = await assertLive('playing');
  console.log('Smoke: live gameplay', JSON.stringify(playingFrames));
  mark('gameplay live');
  const frameStart = await page.evaluate(() => ({ frames: window.__game.loop.frames, ticks: window.__game.loop.ticks, time: performance.now() }));
  await page.waitForTimeout(4000);
  const frameEnd = await page.evaluate(() => ({ frames: window.__game.loop.frames, ticks: window.__game.loop.ticks, time: performance.now() }));
  const measuredFps = (frameEnd.frames - frameStart.frames) * 1000 / (frameEnd.time - frameStart.time);
  const interfaceResult = await checkInterface(page);
  mark('interface, persistence, audio');
  console.log('Smoke: booted WebGL2; checking walking and camera walls');
  // Long deterministic routes are stepped in small chunks. One synchronous block of
  // 840+ steps starves the software renderer's main thread and the CDP call never
  // returns; chunking keeps every round trip short and lets each phase be timed.
  const stepChunk = async (count, label) => {
    for (let done = 0; done < count; done += 60) {
      const n = Math.min(60, count - done);
      await page.evaluate(steps => {
        const game = window.__game;
        for (let i = 0; i < steps; i++) game.step(1 / 60, false);
      }, n);
      await page.waitForTimeout(20);
      mark(`${label} ${done + n}/${count}`);
    }
  };
  await page.evaluate(() => {
    const game = window.__game;
    // Stop the frame source before the deterministic route. Under a software
    // rasteriser a live rAF loop plus its watchdog competes with these synchronous
    // evaluates for the same main thread, and one presented frame can block for tens
    // of seconds. The route checks read the rig's own solved arm position, so they do
    // not need a presented frame.
    game.loop.stop();
    if (game.ui) game.ui.start(false);
    if (game.player.vehicle) game.player.vehicle.driver = null;
    game.player.vehicle = null; game.player.mode = 'foot';
  });
  mark('frame source stopped');
  const wall = await page.evaluate(() => {
    const box = window.__game.world.collision.boxes.find(b => b.tag === 'building' && b.min.x > -200 && b.max.x < 100);
    return box ? { x: box.max.x, z: (box.min.z + box.max.z) / 2 } : null;
  });
  assert.ok(wall, 'no building collider found for the camera wall test');
  const walls = [];
  for (let preset = 0; preset < 3; preset++) {
    await page.evaluate(({ x, z, preset }) => {
      const game = window.__game;
      game.player.teleport(x + .38, .15, z, Math.PI / 2);
      game.cameraRig.reset(game.player); game.cameraRig.setPreset(preset);
    }, { x: wall.x, z: wall.z, preset });
    await stepChunk(120, `wall preset ${preset}`);
    walls.push(await page.evaluate(() => {
      const game = window.__game;
      // cameraRig.position is the arm solution after its sphere-cast pull-in, which is
      // what the wall test asserts on; view.camera only adds the presentation lerp.
      return { preset: game.cameraRig.preset, distance: +game.cameraRig.distance.toFixed(3),
        collisionHits: game.cameraRig.collisionHits,
        cameraInside: game.world.collision.inside(game.cameraRig.position, .2) };
    }));
  }
  await page.evaluate(() => {
    const game = window.__game;
    game.player.teleport(-20, .15, -240, 0); game.cameraRig.reset(game.player);
    game.input.keys.add('KeyW');
  });
  await stepChunk(480, 'walk');
  const walkingMetres = await page.evaluate(() => {
    const game = window.__game; game.input.clear();
    return { metres: game.player.position.z + 240,
      cameraInside: game.world.collision.inside(game.cameraRig.position, .2) };
  });
  const foundation = { walls, walkingMetres: walkingMetres.metres, walkCameraInside: walkingMetres.cameraInside };
  assert.ok(foundation.walls.every(result => !result.cameraInside && result.collisionHits > 0), JSON.stringify(foundation));
  assert.ok(foundation.walkingMetres > 30, JSON.stringify(foundation));
  assert.equal(foundation.walkCameraInside, false, JSON.stringify(foundation));
  console.log('Smoke: camera and walking', JSON.stringify(foundation));
  mark('walking and camera walls');
  const hasVehicles = await page.evaluate(() => !!window.__game.vehicles);
  let driving = null;
  if (hasVehicles) {
    await page.evaluate(() => {
      const game = window.__game;
      game.cameraRig.cinematic = false;
      game.player.teleport(149, .15, -105, 0); game.cameraRig.reset(game.player);
      game.step(1 / 60, false);
    });
    const transitions = [];
    let maxCameraJump = 0, cameraInside = 0;
    const watch = async steps => {
      for (let i = 0; i < steps; i++) {
        const report = await page.evaluate(() => {
          const game = window.__game;
          const before = game.cameraRig.position.toArray();
          game.step(1 / 60, false);
          const after = game.cameraRig.position;
          return { jump: Math.hypot(after.x - before[0], after.y - before[1], after.z - before[2]),
            inside: game.world.collision.inside(game.cameraRig.position, .2) };
        });
        maxCameraJump = Math.max(maxCameraJump, report.jump);
        if (report.inside) cameraInside++;
      }
    };
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const expected of ['driving', 'foot']) {
        const started = await page.evaluate(() => window.__game.vehicles.interact());
        await watch(30);
        transitions.push({ started, expected, actual: await page.evaluate(() => window.__game.player.mode) });
        mark(`enter/exit ${expected}`);
      }
    }
    await page.evaluate(() => window.__game.vehicles.interact());
    await watch(30);
    const startZ = await page.evaluate(() => window.__game.player.position.z);
    await page.evaluate(() => window.__game.input.keys.add('KeyW'));
    for (let done = 0; done < 1320; done += 60) {
      const report = await page.evaluate(steps => {
        const game = window.__game;
        let inside = 0;
        for (let i = 0; i < steps; i++) {
          game.step(1 / 60, false);
          if (game.world.collision.inside(game.cameraRig.position, .2)) inside++;
        }
        return { inside, speed: game.player.vehicle?.speed };
      }, 60);
      cameraInside += report.inside;
      await page.waitForTimeout(20);
      mark(`drive ${done + 60}/1320 at ${report.speed?.toFixed(1)} m/s`);
    }
    const finish = await page.evaluate(startZ => {
      const game = window.__game;
      game.input.clear();
      return { metres: game.player.position.z - startZ, finalSpeed: game.player.vehicle?.speed,
        gear: game.player.vehicle?.gear, rpm: game.player.vehicle?.rpm };
    }, startZ);
    driving = { transitions, maxCameraJump, cameraInside, ...finish };
  }
  if (driving) {
    assert.ok(driving.transitions.every(result => result.started && result.actual === result.expected), JSON.stringify(driving));
    assert.ok(driving.maxCameraJump < 1 && driving.cameraInside === 0 && driving.metres > 300, JSON.stringify(driving));
    console.log('Smoke: vehicle route and transitions', JSON.stringify(driving));
  }
  mark('driving route and transitions');
  // Quality is checked in two halves. The preset the game booted with pays for one real
  // GPU frame, so the reported draw-call count comes from a presented frame. The other
  // three are read from the pinned preset table inside the page and paired with the
  // streaming radius each one drives, because switching this container's software
  // rasteriser onto the shadowed pipeline costs about sixteen seconds once (measured,
  // see the README) and would dominate the run without proving anything new.
  const presets = await page.evaluate(async ({ names, rendered }) => {
    const game = window.__game;
    const { QUALITY } = await import('/src/render/renderer.js');
    const rows = {};
    for (const name of names) {
      game.world.buildings.update(game.player.position, name);
      rows[name] = { ...QUALITY[name],
        chunks: game.world.buildings.chunks.filter(chunk => chunk.group.visible).length };
    }
    game.view.setQuality(rendered);
    game.world.buildings.update(game.player.position, rendered);
    game.cameraRig.present(1, game);
    const at = Date.now();
    game.view.render(1 / 60, game.loop.time);
    return { rows, live: { quality: rendered, ms: Date.now() - at,
      pixelRatio: game.view.renderer.getPixelRatio(),
      shadowsActive: game.view.renderer.shadowMap.enabled,
      chunks: rows[rendered].chunks, ...game.view.stats } };
  }, { names: PRESETS, rendered: SWEEP[0] });
  const { rows, live } = presets;
  console.log('Smoke: quality presets', JSON.stringify(rows));
  console.log('Smoke: rendered preset', JSON.stringify(live));
  mark('quality presets');
  for (const name of PRESETS) {
    const row = rows[name];
    assert.ok(row && row.ratio > 0 && row.shadowSize > 0 && typeof row.shadows === 'boolean'
      && typeof row.post === 'boolean', JSON.stringify(row));
  }
  // The presets must actually differ, otherwise "four quality levels" is only a label,
  // and higher quality must stream more of the city in.
  const fingerprint = row => `${row.ratio}|${row.shadows}|${row.shadowSize}|${row.post}`;
  assert.equal(new Set(PRESETS.map(name => fingerprint(rows[name]))).size, PRESETS.length, JSON.stringify(rows));
  assert.notEqual(fingerprint(rows.low), fingerprint(rows.ultra), JSON.stringify(rows));
  assert.ok(rows.low.chunks <= rows.med.chunks && rows.med.chunks <= rows.ultra.chunks, JSON.stringify(rows));
  assert.ok(live.calls > 0 && live.calls < 600, JSON.stringify(live));
  assert.ok(live.triangles > 0 && live.pixelRatio > 0, JSON.stringify(live));
  assert.equal(live.shadowsActive, rows[live.quality].shadows, JSON.stringify(live));
  // The verdict is recorded before the optional identity query. This container's CDP
  // round trips occasionally block for minutes under memory pressure, so every late
  // call is raced against a timeout and the console counters are captured here, where
  // they cannot be lost to a stalled round trip.
  const consoleErrors = errors.length, consoleWarnings = warnings.length;
  assert.equal(consoleErrors, 0, errors.join('\n'));
  assert.equal(consoleWarnings, 0, warnings.join('\n'));
  const verdict = { foundation, driving, interfaceResult, menuFrames, playingFrames, measuredFps,
    viewport: VIEWPORT, qualityRows: rows, renderedPreset: live,
    realtimeTicks: frameEnd.ticks - frameStart.ticks, realtimeSeconds: (frameEnd.time - frameStart.time) / 1000,
    consoleErrors, consoleWarnings };
  const grab = (label, fn, arg) => {
    const pending = page.evaluate(fn, arg).catch(error => ({ [`${label}Error`]: String(error.message).slice(0, 160) }));
    return Promise.race([pending, new Promise(resolve => setTimeout(() => resolve({ [`${label}Timeout`]: true }), 45000))]);
  };
  // Game state first: it is pure JS and always answers. The GL identity query is a
  // separate round trip, because a synchronised driver query can block this
  // container's GPU process for minutes without telling anything about the game.
  const state = await grab('snapshot', () => {
    const game = window.__game;
    return { ...game.snapshot(), ...game.view.stats, loopErrors: game.loop.errors };
  });
  const gpu = await grab('identity', () => {
    const gl = window.__game.view.renderer.getContext();
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  if (state.snapshotTimeout || state.snapshotError) console.log('Smoke: final snapshot round trip did not return', JSON.stringify(state));
  else {
    assert.ok(state.ticks > 0, JSON.stringify(state));
    assert.equal(state.loopErrors, 0, JSON.stringify(state));
  }
  if (gpu.identityTimeout || gpu.identityError) console.log('Smoke: GL identity query unavailable', JSON.stringify(gpu));
  mark('final snapshot');
  console.log('SMOKE_RESULT ' + JSON.stringify({ ...state, ...gpu, ...verdict }, null, 2));
} finally {
  // A blocked renderer can outlive the run; close politely, then force-kill so the
  // script always terminates and the container's memory is released.
  const child = typeof browser.process === "function" ? browser.process() : null;
  await Promise.race([browser.close().catch(() => {}), new Promise(resolve => setTimeout(resolve, 15000))]);
  if (child && child.exitCode === null) child.kill('SIGKILL');
}
