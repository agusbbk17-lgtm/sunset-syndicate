export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const damping = (rate, dt) => 1 - Math.exp(-rate * dt);
export const lerp = (a, b, t) => a + (b - a) * t;
export const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const dampAngle = (from, to, rate, dt) => from + angleDelta(from, to) * damping(rate, dt);
export const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
