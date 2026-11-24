export const FIXED_DT = 1 / 60;
export class FixedStepLoop {
  constructor(update, present) {
    this.update = update;
    this.present = present;
    this.accumulator = 0;
    this.time = 0;
    this.ticks = 0;
    this.paused = false;
    this.manual = false;
    this.frames = 0;
    this.frameMs = 16.7;
    this.last = null;
  }
  step(dt = FIXED_DT, present = true) {
    const ticks = Math.max(0, Math.round(Math.min(.25, dt) / FIXED_DT));
    for (let i = 0; i < ticks; i++) {
      this.update(FIXED_DT);
      this.time += FIXED_DT;
      this.ticks++;
    }
    if (present) this.present(1, ticks * FIXED_DT);
    return this.ticks;
  }
  start() {
    const frame = now => {
      const elapsed = this.last === null ? 0 : Math.min(.25, (now - this.last) / 1000);
      this.last = now;
      this.frameMs += (elapsed * 1000 - this.frameMs) * .04;
      if (!this.paused && !this.manual && !document.hidden) {
        this.accumulator += elapsed;
        while (this.accumulator >= FIXED_DT) {
          this.update(FIXED_DT);
          this.time += FIXED_DT;
          this.ticks++;
          this.accumulator -= FIXED_DT;
        }
      } else this.accumulator = 0;
      if (!document.hidden && !this.manual) this.present(this.paused ? 1 : this.accumulator / FIXED_DT, elapsed);
      this.frames++;
      this.handle = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', () => { this.last = null; this.accumulator = 0; });
    this.handle = requestAnimationFrame(frame);
  }
}
