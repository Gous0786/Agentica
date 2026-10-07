/**
 * A single shared requestAnimationFrame loop for every Agentica visual.
 *
 * - One rAF for the whole page, no matter how many visuals are mounted.
 * - Zero cost when idle: the loop stops when the last subscriber leaves.
 * - Subscribers run in ascending `priority` order (signals before renderers).
 * - Per-subscriber `maxFps` throttling, each with its own correct delta.
 * - Deltas are clamped so a backgrounded tab doesn't cause a huge jump.
 * - A throwing subscriber is reported and skipped; it can't stall the loop.
 */

export interface FrameInfo {
  /** Seconds since the loop started, scaled by `timeScale`. */
  readonly time: number;
  /** Seconds since this subscriber last ran (clamped, scaled). */
  readonly delta: number;
  /** Global frame counter. Use it to dedupe work shared between subscribers. */
  readonly frame: number;
}

export type FrameCallback = (info: FrameInfo) => void;

export interface FrameSubscribeOptions {
  /** Lower runs first. Use `FramePriority` for conventional slots. Default: `FramePriority.render`. */
  priority?: number;
  /** Cap how often this callback runs. Omit or 0 for every frame. */
  maxFps?: number;
}

export const FramePriority = {
  /** Input sampling: audio analysers, pointer smoothing. */
  input: -100,
  /** State/param tweens that renderers read. */
  update: -50,
  render: 0,
  /** Post-render work: stats, debug overlays. */
  after: 100,
} as const;

interface Subscriber {
  callback: FrameCallback;
  priority: number;
  minInterval: number;
  lastTime: number;
  order: number;
}

export interface FrameLoopOptions {
  requestFrame?: (cb: (now: number) => void) => number;
  cancelFrame?: (id: number) => void;
  /** Upper bound for a single delta, in seconds. Default 0.1 (= 10fps). */
  maxDelta?: number;
}

export class FrameLoop {
  /** Multiplies time and delta for every subscriber. 0 freezes time without stopping the loop. */
  timeScale = 1;

  private subscribers: Subscriber[] = [];
  private rafId: number | null = null;
  private lastNow: number | null = null;
  private time = 0;
  private frame = 0;
  private order = 0;
  private readonly maxDelta: number;
  private readonly requestFrame: (cb: (now: number) => void) => number;
  private readonly cancelFrame: (id: number) => void;
  /** False during SSR, where subscribing is a harmless no-op. */
  private readonly canSchedule: boolean;

  constructor(options: FrameLoopOptions = {}) {
    this.maxDelta = options.maxDelta ?? 0.1;
    this.canSchedule =
      options.requestFrame !== undefined || typeof globalThis.requestAnimationFrame === "function";
    this.requestFrame = options.requestFrame ?? ((cb) => globalThis.requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((id) => globalThis.cancelAnimationFrame(id));
  }

  get running(): boolean {
    return this.rafId !== null;
  }

  get size(): number {
    return this.subscribers.length;
  }

  /** Frames ticked since creation. Diagnostics poll this to measure FPS without subscribing. */
  get frameCount(): number {
    return this.frame;
  }

  /** Current loop time in seconds (for code that runs outside a frame callback). */
  get now(): number {
    return this.time;
  }

  subscribe(callback: FrameCallback, options: FrameSubscribeOptions = {}): () => void {
    const subscriber: Subscriber = {
      callback,
      priority: options.priority ?? FramePriority.render,
      minInterval: options.maxFps && options.maxFps > 0 ? 1 / options.maxFps : 0,
      lastTime: Number.NaN,
      order: this.order++,
    };

    // Copy-on-write keeps iteration safe when callbacks (un)subscribe mid-frame.
    this.subscribers = [...this.subscribers, subscriber].sort(
      (a, b) => a.priority - b.priority || a.order - b.order,
    );
    this.start();

    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== subscriber);
      if (this.subscribers.length === 0) this.stop();
    };
  }

  /** Run a callback on the next frame only. */
  once(callback: FrameCallback, options?: FrameSubscribeOptions): () => void {
    const unsubscribe = this.subscribe((info) => {
      unsubscribe();
      callback(info);
    }, options);
    return unsubscribe;
  }

  private start() {
    if (this.rafId !== null || !this.canSchedule) return;
    this.lastNow = null;
    this.rafId = this.requestFrame(this.tick);
  }

  private stop() {
    if (this.rafId !== null) this.cancelFrame(this.rafId);
    this.rafId = null;
    this.lastNow = null;
  }

  private tick = (now: number) => {
    // Resuming after a stop starts with a zero delta rather than the idle gap.
    const rawDelta = this.lastNow === null ? 0 : (now - this.lastNow) / 1000;
    this.lastNow = now;
    const delta = Math.min(Math.max(rawDelta, 0), this.maxDelta) * this.timeScale;
    this.time += delta;
    this.frame++;

    // Schedule first so a throwing subscriber can't kill the loop.
    this.rafId = this.requestFrame(this.tick);

    const time = this.time;
    const frame = this.frame;
    for (const s of this.subscribers) {
      let subDelta: number;
      if (Number.isNaN(s.lastTime)) {
        subDelta = 0;
      } else {
        subDelta = time - s.lastTime;
        // Small tolerance so 60fps callers on a 60Hz display don't skip alternate frames.
        if (s.minInterval > 0 && subDelta < s.minInterval * 0.95) continue;
      }
      s.lastTime = time;
      try {
        s.callback({ time, delta: Math.min(subDelta, this.maxDelta), frame });
      } catch (error) {
        console.error("[agentica] frame callback threw:", error);
      }
    }

    if (this.subscribers.length === 0) this.stop();
  };
}

/** The page-wide loop shared by all Agentica visuals. */
export const frameLoop = new FrameLoop();
