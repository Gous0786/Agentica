import { FramePriority, frameLoop } from "@/lib/agentica/core/frame-loop";

/**
 * What every audio-reactive visual reads. Visuals never touch Web Audio
 * directly, so the same visual works with a microphone, an <audio> element, a
 * provider SDK's volume callback, or a synthetic signal in demos and tests.
 *
 * Signals drive themselves: while at least one consumer has `retain()`ed it,
 * the signal samples once per frame on the shared loop (at input priority,
 * before any renderer). Consumers only read. No consumers means no work.
 *
 * Arrays are reused between frames: read them, don't hold on to their contents.
 */
export interface AudioSignal {
  /** Perceptual loudness, 0..1, envelope-smoothed. */
  readonly volume: number;
  /** Magnitude per FFT bin, 0..1. Length is `binCount`. */
  readonly frequency: Float32Array;
  /** Time-domain samples, -1..1. */
  readonly waveform: Float32Array;
  readonly binCount: number;
  /** Maps bins to Hz: bin i ≈ i * sampleRate / 2 / binCount. */
  readonly sampleRate: number;
  /** Start sampling (ref-counted). Returns an idempotent release function. */
  retain(): () => void;
  /** Advance manually by `delta` seconds (tests, offline rendering). */
  step(delta: number): void;
  dispose(): void;
}

export function isAudioSignal(value: unknown): value is AudioSignal {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AudioSignal).retain === "function" &&
    (value as AudioSignal).frequency instanceof Float32Array
  );
}

/** Base class: ref-counted self-scheduling on the shared frame loop. */
export abstract class BaseAudioSignal implements AudioSignal {
  volume = 0;
  readonly frequency: Float32Array<ArrayBuffer>;
  readonly waveform: Float32Array<ArrayBuffer>;
  readonly binCount: number;
  readonly sampleRate: number;
  private consumers = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(binCount: number, sampleRate: number, waveformSize = binCount * 2) {
    this.binCount = binCount;
    this.sampleRate = sampleRate;
    this.frequency = new Float32Array(binCount);
    this.waveform = new Float32Array(waveformSize);
  }

  retain(): () => void {
    if (++this.consumers === 1) {
      this.unsubscribe = frameLoop.subscribe(({ delta }) => this.sample(delta), {
        priority: FramePriority.input,
      });
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.consumers === 0) {
        this.unsubscribe?.();
        this.unsubscribe = null;
      }
    };
  }

  step(delta: number): void {
    this.sample(delta);
  }

  protected abstract sample(delta: number): void;

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.consumers = 0;
  }
}

class SilentSignal extends BaseAudioSignal {
  protected sample(): void {}
  override retain(): () => void {
    return () => {};
  }
}

/** A shared always-silent signal: the default when no audio is provided. */
export const silentSignal: AudioSignal = new SilentSignal(64, 48000);
