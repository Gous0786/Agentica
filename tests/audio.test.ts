import { describe, expect, it } from "vitest";
import { computeBands } from "@/lib/agentica/audio/bands";
import { isAudioSignal, silentSignal } from "@/lib/agentica/audio/signal";
import { SyntheticSignal } from "@/lib/agentica/audio/synthetic-signal";
import { VolumeSignal } from "@/lib/agentica/audio/volume-signal";
import { frameLoop } from "@/lib/agentica/core/frame-loop";

function run(signal: { step: (delta: number) => void }, seconds: number, onFrame?: () => void) {
  for (let frame = 0; frame < seconds * 60; frame++) {
    signal.step(1 / 60);
    onFrame?.();
  }
}

describe("SyntheticSignal", () => {
  it("produces bounded, varying, speech-like output", () => {
    const signal = new SyntheticSignal({ seed: 4 });
    const volumes: number[] = [];
    run(signal, 6, () => volumes.push(signal.volume));
    expect(Math.max(...volumes)).toBeGreaterThan(0.3);
    expect(Math.min(...volumes.slice(30))).toBeLessThan(0.15); // pauses between phrases
    for (const v of signal.frequency) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of signal.frequency) expect(v).toBeLessThanOrEqual(1);
  });

  it("is deterministic for a seed", () => {
    const a = new SyntheticSignal({ seed: 9 });
    const b = new SyntheticSignal({ seed: 9 });
    run(a, 2);
    run(b, 2);
    expect(a.volume).toBe(b.volume);
    expect([...a.frequency]).toEqual([...b.frequency]);
  });

  it("goes quiet when speaking is turned off", () => {
    const signal = new SyntheticSignal();
    run(signal, 2);
    signal.speaking = false;
    run(signal, 2);
    expect(signal.volume).toBeLessThan(0.01);
  });

  it("samples on the shared loop only while retained (ref-counted)", () => {
    const signal = new SyntheticSignal();
    const before = frameLoop.size;
    const releaseA = signal.retain();
    const releaseB = signal.retain();
    expect(frameLoop.size).toBe(before + 1);
    releaseA();
    releaseA(); // idempotent
    expect(frameLoop.size).toBe(before + 1);
    releaseB();
    expect(frameLoop.size).toBe(before);
  });
});

describe("VolumeSignal", () => {
  it("follows the external level and synthesizes a spectrum", () => {
    let level = 0.8;
    const signal = new VolumeSignal(() => level);
    run(signal, 1);
    expect(signal.volume).toBeCloseTo(0.8, 2);
    expect(Math.max(...signal.frequency)).toBeGreaterThan(0.1);
    level = 0;
    run(signal, 2);
    expect(signal.volume).toBeLessThan(0.01);
  });

  it("treats bad input as silence", () => {
    const signal = new VolumeSignal(() => Number.NaN);
    run(signal, 1);
    expect(signal.volume).toBe(0);
  });
});

describe("computeBands", () => {
  it("groups bins log-scaled without allocating", () => {
    const frequency = new Float32Array(128).fill(0.5);
    const out = new Float32Array(16);
    const result = computeBands({ frequency, sampleRate: 48000 }, out);
    expect(result).toBe(out);
    for (const v of out) expect(v).toBeCloseTo(0.5);
  });

  it("interpolates bands narrower than a bin, so low bands are not empty", () => {
    const frequency = new Float32Array(32);
    frequency.fill(1, 0, 4);
    const out = computeBands({ frequency, sampleRate: 48000 }, new Float32Array(24), {
      minHz: 20,
      maxHz: 2000,
    });
    expect(out[0]!).toBeGreaterThan(0);
  });
});

describe("signal helpers", () => {
  it("recognises signals", () => {
    expect(isAudioSignal(silentSignal)).toBe(true);
    expect(isAudioSignal(new SyntheticSignal())).toBe(true);
    expect(isAudioSignal({})).toBe(false);
    expect(isAudioSignal(null)).toBe(false);
  });
});
