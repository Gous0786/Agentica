/**
 * Allocation-free math helpers for per-frame code. Everything here is safe to
 * call thousands of times per frame.
 */

export const TAU = Math.PI * 2;

export function clamp(value: number, min = 0, max = 1): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

/** Map `value` from [inMin, inMax] to [outMin, outMax], clamped. */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return lerp(outMin, outMax, clamp(inverseLerp(inMin, inMax, value)));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp(inverseLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Frame-rate independent exponential smoothing toward `target`.
 * `lambda` is responsiveness (1/s): ~4 is soft, ~12 is snappy.
 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * delta));
}

/**
 * Asymmetric smoothing: rise with `attack`, fall with `release` (both 1/s).
 * The standard envelope follower for audio levels.
 */
export function envelope(
  current: number,
  target: number,
  attack: number,
  release: number,
  delta: number,
): number {
  return damp(current, target, target > current ? attack : release, delta);
}

export interface SpringConfig {
  /** Default 170. */
  stiffness?: number;
  /** Default 26 (≈ critically damped at mass 1). */
  damping?: number;
  /** Default 1. */
  mass?: number;
}

const MAX_SPRING_STEP = 1 / 120;

/**
 * Advance one damped spring in place. State lives in caller-owned arrays so
 * nothing is allocated per frame. Sub-steps keep it stable at low frame rates.
 */
export function stepSpring(
  values: Float32Array,
  velocities: Float32Array,
  index: number,
  target: number,
  config: SpringConfig,
  delta: number,
): void {
  const k = config.stiffness ?? 170;
  const c = config.damping ?? 26;
  const m = config.mass ?? 1;
  let x = values[index]!;
  let v = velocities[index]!;
  let remaining = delta;
  while (remaining > 0) {
    const dt = remaining > MAX_SPRING_STEP ? MAX_SPRING_STEP : remaining;
    v += ((-k * (x - target) - c * v) / m) * dt;
    x += v * dt;
    remaining -= dt;
  }
  values[index] = x;
  velocities[index] = v;
}

/** Deterministic 0..1 hash of an integer. Useful for stable per-instance randomness. */
export function hash(seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
