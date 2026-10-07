import { describe, expect, it } from "vitest";
import { ParamTween } from "@/lib/agentica/agent/param-tween";
import { damp, envelope, remap, stepSpring } from "@/lib/agentica/core/math";

describe("math", () => {
  it("damp is frame-rate independent", () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = damp(at60, 1, 5, 1 / 60);
    let at15 = 0;
    for (let i = 0; i < 15; i++) at15 = damp(at15, 1, 5, 1 / 15);
    expect(at60).toBeCloseTo(at15, 6);
  });

  it("envelope rises with attack and falls with release", () => {
    // Fast attack: most of the way up in 50ms. Slow release: barely down in 50ms.
    expect(envelope(0, 1, 30, 1, 0.05)).toBeGreaterThan(0.7);
    expect(envelope(1, 0, 30, 1, 0.05)).toBeGreaterThan(0.9);
  });

  it("remap clamps", () => {
    expect(remap(-100, -60, -10, 0, 1)).toBe(0);
    expect(remap(0, -60, -10, 0, 1)).toBe(1);
    expect(remap(-35, -60, -10, 0, 1)).toBeCloseTo(0.5);
  });

  it("springs settle and stay stable at low frame rates", () => {
    const values = new Float32Array([0]);
    const velocities = new Float32Array([0]);
    for (let i = 0; i < 20; i++) stepSpring(values, velocities, 0, 1, {}, 0.1);
    expect(values[0]).toBeCloseTo(1, 3);
    expect(Number.isFinite(velocities[0]!)).toBe(true);
  });
});

describe("ParamTween", () => {
  const idle = { speed: 0.2, color: [0, 0, 0, 1] };
  const busy = { speed: 1, color: [1, 0.5, 0, 1] };

  it("starts at the initial values, settled", () => {
    const tween = new ParamTween(idle);
    expect(tween.values.speed).toBeCloseTo(0.2);
    expect([...tween.values.color]).toEqual([0, 0, 0, 1]);
    expect(tween.isSettled).toBe(true);
    expect(tween.update(1 / 60)).toBe(false);
  });

  it("moves toward a new target and settles exactly on it", () => {
    const tween = new ParamTween(idle);
    tween.setTarget(busy);
    tween.update(1 / 60);
    expect(tween.values.speed).toBeGreaterThan(0.2);
    expect(tween.values.speed).toBeLessThan(1);
    for (let i = 0; i < 300 && tween.update(1 / 60); i++);
    expect(tween.isSettled).toBe(true);
    expect(tween.values.speed).toBe(1);
    expect(tween.values.color[1]).toBeCloseTo(0.5);
  });

  it("vector values are stable views (safe to hand to uniforms once)", () => {
    const tween = new ParamTween(idle);
    const view = tween.values.color;
    tween.setTarget(busy);
    tween.snap();
    expect(tween.values.color).toBe(view);
    expect(view[0]).toBe(1);
  });

  it("supports damp transitions and per-param overrides", () => {
    const tween = new ParamTween(idle, {
      transition: { type: "damp", lambda: 2 },
      transitions: { color: { type: "damp", lambda: 50 } },
    });
    tween.setTarget(busy);
    tween.update(0.1);
    expect(tween.values.color[0]!).toBeGreaterThan(0.99);
    expect(tween.values.speed).toBeLessThan(0.5);
  });
});
