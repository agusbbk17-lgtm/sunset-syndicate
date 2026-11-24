import { clamp } from './math.js';
export class PlayerInput {
  constructor(canvas) {
    this.keys = new Set(); this.pressed = new Set(); this.released = new Set();
    this.buttons = new Set(); this.lookX = 0; this.lookY = 0; this.wheel = 0;
    this.sensitivity = 1; this.enabled = true; this.gamepadPrevious = [];
    window.addEventListener('keydown', event => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      if (!this.keys.has(event.code)) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => { this.keys.delete(event.code); this.released.add(event.code); });
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('mousemove', event => {
      if (document.pointerLockElement === canvas && this.enabled) {
        this.lookX += event.movementX * .0025 * this.sensitivity;
        this.lookY += event.movementY * .0025 * this.sensitivity;
      }
    });
    canvas.addEventListener('pointerdown', event => {
      this.buttons.add(event.button);
      if (this.enabled && document.pointerLockElement !== canvas) {
        const request = canvas.requestPointerLock();
        request?.catch(() => {});
      }
    });
    window.addEventListener('pointerup', event => this.buttons.delete(event.button));
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('wheel', event => { this.wheel += Math.sign(event.deltaY); event.preventDefault(); }, { passive: false });
  }
  down(code) { return this.enabled && this.keys.has(code); }
  consume(code) { const value = this.pressed.has(code); this.pressed.delete(code); return value; }
  sampleGamepad(dt) {
    this.padX = 0; this.padY = 0; this.padThrottle = 0; this.padBrake = 0;
    const pad = navigator.getGamepads?.()[0];
    if (!pad || !this.enabled) return;
    const deadzone = value => Math.abs(value) < .14 ? 0 : value;
    this.padX = deadzone(pad.axes[0] || 0); this.padY = deadzone(pad.axes[1] || 0);
    this.lookX += deadzone(pad.axes[2] || 0) * dt * 2.2;
    this.lookY += deadzone(pad.axes[3] || 0) * dt * 1.8;
    this.padThrottle = pad.buttons[7]?.value || 0;
    this.padBrake = pad.buttons[6]?.value || 0;
    const mapping = { 0: 'Space', 1: 'KeyC', 2: 'KeyE', 3: 'KeyV', 4: 'KeyQ', 5: 'KeyX', 8: 'KeyM', 9: 'Escape', 10: 'ShiftLeft' };
    for (const [index, code] of Object.entries(mapping)) {
      const held = pad.buttons[index]?.pressed;
      if (held && !this.gamepadPrevious[index]) this.pressed.add(code);
      if (held) this.keys.add(code);
      else if (this.gamepadPrevious[index]) this.keys.delete(code);
      this.gamepadPrevious[index] = held;
    }
  }
  get move() {
    if (!this.enabled) return { x: 0, y: 0 };
    return { x: clamp(Number(this.down('KeyD')) - Number(this.down('KeyA')) + (this.padX || 0), -1, 1),
      y: clamp(Number(this.down('KeyW')) - Number(this.down('KeyS')) - (this.padY || 0), -1, 1) };
  }
  endTick() { this.pressed.clear(); this.released.clear(); this.lookX = 0; this.lookY = 0; this.wheel = 0; }
  clear() { this.keys.clear(); this.buttons.clear(); this.endTick(); }
}
