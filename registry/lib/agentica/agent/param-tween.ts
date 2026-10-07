import { damp, type SpringConfig, stepSpring } from "@/lib/agentica/core/math";

/** A tweenable parameter: a scalar, or a fixed-length vector (e.g. an RGBA color). */
export type ParamValue = number | readonly number[] | Float32Array;
export type ParamRecord = Record<string, ParamValue>;

/** Live values: scalars are numbers, vectors are `Float32Array` views (ready for uniforms). */
export type ParamValues<P extends ParamRecord> = {
  -readonly [K in keyof P]: P[K] extends number ? number : Float32Array;
};

export type Transition =
  | { type: "damp" /** Responsiveness (1/s). Default 6. */; lambda?: number }
  | ({ type: "spring" } & SpringConfig);

export interface ParamTweenOptions<P extends ParamRecord> {
  /** Default `{ type: "spring" }` (≈ critically damped). */
  transition?: Transition;
  /** Per-parameter overrides, e.g. snappy color but slow speed. */
  transitions?: Partial<Record<keyof P, Transition>>;
}

interface Slot {
  key: string;
  offset: number;
  length: number;
  scalar: boolean;
  transition: Transition;
}

const EPSILON = 1e-4;

/**
 * Smoothly moves a set of numeric params toward a target set. All state lives
 * in flat typed arrays, so `update()` allocates nothing. The engine behind
 * state-driven visuals: the target changes on a state change, and the frame
 * loop calls `update(delta)`.
 */
export class ParamTween<P extends ParamRecord> {
  readonly values: ParamValues<P>;
  private readonly slots: Slot[];
  private readonly current: Float32Array;
  private readonly target: Float32Array;
  private readonly velocity: Float32Array;
  private settled = true;

  constructor(initial: P, options: ParamTweenOptions<P> = {}) {
    const fallback: Transition = options.transition ?? { type: "spring" };
    let size = 0;
    this.slots = Object.keys(initial).map((key) => {
      const value = initial[key]!;
      const scalar = typeof value === "number";
      const length = scalar ? 1 : value.length;
      const slot: Slot = {
        key,
        offset: size,
        length,
        scalar,
        transition: options.transitions?.[key as keyof P] ?? fallback,
      };
      size += length;
      return slot;
    });

    this.current = new Float32Array(size);
    this.target = new Float32Array(size);
    this.velocity = new Float32Array(size);
    this.values = {} as ParamValues<P>;
    const values = this.values as Record<string, number | Float32Array>;
    for (const slot of this.slots) {
      if (!slot.scalar) {
        values[slot.key] = this.current.subarray(slot.offset, slot.offset + slot.length);
      }
    }
    this.write(this.target, initial);
    this.snap();
  }

  /** True when every param has reached its target. Skip redraws when settled and idle. */
  get isSettled(): boolean {
    return this.settled;
  }

  setTarget(target: P): void {
    this.write(this.target, target);
    this.settled = false;
  }

  /** Jump straight to the target (reduced motion, first paint, paused visuals). */
  snap(): void {
    this.current.set(this.target);
    this.velocity.fill(0);
    this.settled = true;
    this.syncScalars();
  }

  /** Advance by `delta` seconds. Returns true while still moving. */
  update(delta: number): boolean {
    if (this.settled) return false;
    let moving = false;
    const { current, target, velocity } = this;
    for (const slot of this.slots) {
      const t = slot.transition;
      for (let i = slot.offset; i < slot.offset + slot.length; i++) {
        if (t.type === "spring") stepSpring(current, velocity, i, target[i]!, t, delta);
        else current[i] = damp(current[i]!, target[i]!, t.lambda ?? 6, delta);
        if (Math.abs(current[i]! - target[i]!) > EPSILON || Math.abs(velocity[i]!) > EPSILON) {
          moving = true;
        }
      }
    }
    if (!moving) {
      current.set(target);
      velocity.fill(0);
    }
    this.settled = !moving;
    this.syncScalars();
    return moving;
  }

  private write(buffer: Float32Array, record: P) {
    for (const slot of this.slots) {
      const value = record[slot.key];
      if (value === undefined) continue;
      if (typeof value === "number") {
        buffer[slot.offset] = value;
      } else {
        for (let i = 0; i < slot.length; i++) buffer[slot.offset + i] = value[i] ?? 0;
      }
    }
  }

  private syncScalars() {
    const values = this.values as Record<string, number | Float32Array>;
    for (const slot of this.slots) {
      if (slot.scalar) values[slot.key] = this.current[slot.offset]!;
    }
  }
}
