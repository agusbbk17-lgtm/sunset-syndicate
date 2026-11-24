export const FIXED_DT = 1 / 60;
export class FixedStepLoop {
  constructor(update, present, onError = error => console.error('Frame callback failed:', error.stack || error)) {
    this.update = update; this.present = present; this.onError = onError;
    this.accumulator = 0; this.time = 0; this.ticks = 0;
    this.paused = false; this.manual = false; this.frames = 0;
    this.frameMs = 16.7; this.last = null; this.running = false;
    this.errors = 0; this.lastError = null; this.watchdogFrames = 0;
  }
  step(dt = FIXED_DT, present = true) {
    const ticks = Math.max(0, Math.round(Math.min(.25, dt) / FIXED_DT));
    for (let i = 0; i < ticks; i++) {
      this.update(FIXED_DT); this.time += FIXED_DT; this.ticks++;
    }
    if (present) this.present(1, ticks * FIXED_DT);
    return this.ticks;
  }
  start(host = globalThis) {
    if (this.running) return;
    this.running = true; this.host = host; this.deliveredAt = host.performance.now();
    const frame = now => {
      if (!this.running) return;
      // Re-arm first: neither simulation nor presentation can sever the chain.
      this.handle = host.requestAnimationFrame(frame);
      this.deliveredAt = host.performance.now();
      try {
        const elapsed = this.last === null ? 0 : Math.max(0, Math.min(.25, (now - this.last) / 1000));
        this.last = now; this.frameMs += (elapsed * 1000 - this.frameMs) * .04;
        if (!this.paused && !this.manual && !host.document.hidden) {
          this.accumulator += elapsed;
          while (this.accumulator >= FIXED_DT) {
            this.accumulator -= FIXED_DT;
            this.update(FIXED_DT); this.time += FIXED_DT; this.ticks++;
          }
        } else this.accumulator = 0;
        if (!host.document.hidden && !this.manual) this.present(this.paused ? 1 : this.accumulator / FIXED_DT, elapsed);
      } catch (error) {
        this.accumulator = 0; this.errors++; this.lastError = String(error.stack || error);
        this.onError(error);
      } finally { this.frames++; }
    };
    this.visibility = () => { this.last = null; this.accumulator = 0; this.deliveredAt = host.performance.now(); };
    host.document.addEventListener('visibilitychange', this.visibility);
    this.handle = host.requestAnimationFrame(frame);
    // Some software compositors stop delivering visible-tab RAFs after an idle swap.
    this.watchdog = host.setInterval(() => {
      const now = host.performance.now();
      if (!host.document.hidden && !this.manual && now - this.deliveredAt > 50) {
        host.cancelAnimationFrame(this.handle); this.watchdogFrames++; frame(now);
      }
    }, 1000 / 60);
  }
  stop() {
    if (!this.running) return;
    this.running = false; this.host.cancelAnimationFrame(this.handle); this.host.clearInterval(this.watchdog);
    this.host.document.removeEventListener('visibilitychange', this.visibility);
    this.last = null; this.accumulator = 0;
  }
}
