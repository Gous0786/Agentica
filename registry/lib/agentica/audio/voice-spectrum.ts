import { clamp, hash } from "@/lib/agentica/core/math";

/** Smooth 1D value noise in 0..1. Deterministic for a given seed. */
export function valueNoise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash(i * 7919 + seed);
  const b = hash((i + 1) * 7919 + seed);
  return a + (b - a) * f * f * (3 - 2 * f);
}

/**
 * Fill `frequency` with a plausible voice-like spectrum (pink tilt plus three
 * drifting formants) scaled by `volume`. Lets volume-only sources still drive
 * spectrum visuals.
 */
export function fillVoiceSpectrum(
  frequency: Float32Array,
  sampleRate: number,
  volume: number,
  time: number,
  seed: number,
): void {
  const hzPerBin = sampleRate / 2 / frequency.length;
  const f1 = 450 + 250 * valueNoise(time * 3.1, seed + 1);
  const f2 = 1300 + 700 * valueNoise(time * 2.3, seed + 2);
  const f3 = 2600 + 500 * valueNoise(time * 1.7, seed + 3);
  for (let i = 0; i < frequency.length; i++) {
    const hz = Math.max(i * hzPerBin, 1);
    const tilt = 1 / (1 + hz / 500);
    const formants =
      formant(hz, f1, 0.9) + 0.7 * formant(hz, f2, 0.6) + 0.45 * formant(hz, f3, 0.5);
    const flicker = 0.8 + 0.4 * valueNoise(time * 18 + i * 0.37, seed + 4);
    frequency[i] = clamp((0.35 * tilt + 0.75 * formants) * volume * flicker);
  }
}

/** Gaussian bump in log-frequency, `width` in octaves. */
function formant(hz: number, center: number, width: number): number {
  const d = Math.log2(hz / center) / width;
  return Math.exp(-d * d);
}

/** Fill `waveform` with a voiced tone whose amplitude follows `volume`. */
export function fillVoiceWaveform(
  waveform: Float32Array,
  sampleRate: number,
  volume: number,
  time: number,
): void {
  const f0 = 140;
  for (let i = 0; i < waveform.length; i++) {
    const t = time + i / sampleRate;
    const phase = 2 * Math.PI * f0 * t;
    waveform[i] =
      volume * (0.6 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase));
  }
}
