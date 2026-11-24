import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepLoop } from '../game/src/core/loop.js';
function fakeHost() {
  let id = 0;
  const host = { now: 0, callbacks: new Map(), timers: new Map(), listeners: new Map() };
  host.performance = { now: () => host.now };
  host.document = { hidden: false, addEventListener: (name, fn) => host.listeners.set(name, fn),
    removeEventListener: name => host.listeners.delete(name) };
  host.requestAnimationFrame = fn => { host.callbacks.set(++id, fn); return id; };
  host.cancelAnimationFrame = handle => host.callbacks.delete(handle);
  host.setInterval = fn => { host.timers.set(++id, fn); return id; };
  host.clearInterval = handle => host.timers.delete(handle);
  host.frame = now => {
    host.now = now; const [handle, fn] = host.callbacks.entries().next().value;
    host.callbacks.delete(handle); fn(now);
  };
  return host;
}
test('a throwing frame reports its error without killing the next animation callback', () => {
  const host = fakeHost(); let presents = 0, errors = 0;
  const loop = new FixedStepLoop(() => {}, () => { if (++presents === 1) throw Error('bad frame'); }, () => errors++);
  loop.start(host); loop.start(host); host.frame(0); host.frame(17);
  assert.equal(errors, 1); assert.equal(loop.frames, 2); assert.equal(host.callbacks.size, 1);
  assert.match(loop.lastError, /bad frame/); loop.stop(); assert.equal(host.callbacks.size, 0);
});
test('paused menus present; hidden tabs stop; watchdog replaces a stalled RAF', () => {
  const host = fakeHost(), loop = new FixedStepLoop(() => {}, () => {});
  loop.paused = true; loop.start(host); host.frame(0); host.frame(17);
  assert.equal(loop.ticks, 0); assert.equal(loop.frames, 2);
  host.now = 100; for (const fn of host.timers.values()) fn();
  assert.equal(loop.watchdogFrames, 1); assert.equal(loop.frames, 3); assert.equal(host.callbacks.size, 1);
  loop.paused = false; host.document.hidden = true; host.listeners.get('visibilitychange')();
  host.frame(1000); assert.equal(loop.ticks, 0);
  host.document.hidden = false; host.listeners.get('visibilitychange')(); host.frame(2000); host.frame(2017);
  assert.equal(loop.ticks, 1); loop.stop(); assert.equal(host.timers.size, 0);
});
