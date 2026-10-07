import { describe, expect, it, vi } from "vitest";
import { type FrameInfo, FrameLoop } from "@/lib/agentica/core/frame-loop";

/** A manual rAF: `step(ms)` advances time and runs one frame. */
function createScheduler() {
  let queued: ((now: number) => void) | null = null;
  let now = 0;
  let nextId = 1;
  return {
    requestFrame: (cb: (now: number) => void) => {
      queued = cb;
      return nextId++;
    },
    cancelFrame: () => {
      queued = null;
    },
    step(ms = 1000 / 60) {
      now += ms;
      const cb = queued;
      queued = null;
      cb?.(now);
    },
    get pending() {
      return queued !== null;
    },
  };
}

function setup(options: { maxDelta?: number } = {}) {
  const scheduler = createScheduler();
  const loop = new FrameLoop({ ...scheduler, ...options });
  return { scheduler, loop };
}

describe("FrameLoop", () => {
  it("runs only while there are subscribers", () => {
    const { scheduler, loop } = setup();
    expect(scheduler.pending).toBe(false);
    const off = loop.subscribe(() => {});
    expect(loop.running).toBe(true);
    off();
    expect(loop.running).toBe(false);
    expect(scheduler.pending).toBe(false);
  });

  it("orders subscribers by priority, then subscription order", () => {
    const { scheduler, loop } = setup();
    const calls: string[] = [];
    loop.subscribe(() => calls.push("render-a"));
    loop.subscribe(() => calls.push("input"), { priority: -100 });
    loop.subscribe(() => calls.push("render-b"));
    loop.subscribe(() => calls.push("after"), { priority: 100 });
    scheduler.step();
    expect(calls).toEqual(["input", "render-a", "render-b", "after"]);
  });

  it("starts each subscriber with a zero delta and clamps long gaps", () => {
    const { scheduler, loop } = setup({ maxDelta: 0.1 });
    const deltas: number[] = [];
    loop.subscribe(({ delta }) => deltas.push(delta));
    scheduler.step(16);
    scheduler.step(16);
    scheduler.step(5000); // backgrounded tab
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.016, 5);
    expect(deltas[2]).toBeCloseTo(0.1, 5);
  });

  it("throttles with maxFps and reports the accumulated delta", () => {
    const { scheduler, loop } = setup();
    const fast: FrameInfo[] = [];
    const slow: FrameInfo[] = [];
    loop.subscribe((info) => fast.push(info));
    loop.subscribe((info) => slow.push(info), { maxFps: 30 });
    for (let i = 0; i < 60; i++) scheduler.step(1000 / 60);
    expect(fast).toHaveLength(60);
    expect(slow.length).toBeGreaterThanOrEqual(29);
    expect(slow.length).toBeLessThanOrEqual(31);
    expect(slow[2]!.delta).toBeCloseTo(1 / 30, 3);
  });

  it("does not drop alternate frames for a 60fps cap on a 60Hz display", () => {
    const { scheduler, loop } = setup();
    let count = 0;
    loop.subscribe(() => count++, { maxFps: 60 });
    for (let i = 0; i < 60; i++) scheduler.step(1000 / 60);
    expect(count).toBe(60);
  });

  it("keeps running when a subscriber throws", () => {
    const { scheduler, loop } = setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let healthy = 0;
    loop.subscribe(() => {
      throw new Error("boom");
    });
    loop.subscribe(() => healthy++);
    scheduler.step();
    scheduler.step();
    expect(healthy).toBe(2);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("tolerates unsubscribing during a frame", () => {
    const { scheduler, loop } = setup();
    const calls: string[] = [];
    const offB = loop.subscribe(() => calls.push("b"));
    loop.subscribe(
      () => {
        calls.push("a");
        offB();
      },
      { priority: -1 },
    );
    scheduler.step();
    scheduler.step();
    expect(calls).toEqual(["a", "b", "a"]);
  });

  it("once() runs exactly one time", () => {
    const { scheduler, loop } = setup();
    let count = 0;
    loop.once(() => count++);
    scheduler.step();
    scheduler.step();
    expect(count).toBe(1);
    expect(loop.running).toBe(false);
  });

  it("timeScale scales time and delta", () => {
    const { scheduler, loop } = setup();
    let last: FrameInfo | null = null;
    loop.timeScale = 0.5;
    loop.subscribe((info) => {
      last = info;
    });
    scheduler.step(20);
    scheduler.step(20);
    expect(last!.delta).toBeCloseTo(0.01, 5);
  });

  it("is a harmless no-op without any scheduler (SSR)", () => {
    const raf = globalThis.requestAnimationFrame;
    // @ts-expect-error simulate a server environment
    delete globalThis.requestAnimationFrame;
    try {
      const loop = new FrameLoop();
      const off = loop.subscribe(() => {});
      expect(loop.running).toBe(false);
      off();
    } finally {
      globalThis.requestAnimationFrame = raf;
    }
  });
});
