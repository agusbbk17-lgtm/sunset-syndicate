import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('/root/makefun-gta6-setup/tooling/browser/node_modules/playwright');
const browser = await chromium.launch({
  executablePath: '/root/makefun-gta6-setup/tooling/browser/browsers/chromium-1255/chrome-linux-arm64/chrome',
  headless: false,
  args: ['--use-angle=gl', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu-sandbox', '--ignore-gpu-blocklist'],
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
  console.log(JSON.stringify({ ...result, consoleErrors: errors.length, consoleWarnings: warnings.length }, null, 2));
} finally { await browser.close(); }
