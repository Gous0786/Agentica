import { BaseAudioSignal } from "@/lib/agentica/audio/signal";
import {
  fillVoiceSpectrum,
  fillVoiceWaveform,
  valueNoise,
} from "@/lib/agentica/audio/voice-spectrum";
import { envelope, smoothstep } from "@/lib/agentica/core/math";

export interface SyntheticSignalOptions {
  binCount?: number;
  sampleRate?: number;
  /** Same seed means the same "speech". Default 1. */
  seed?: number;
  /** Overall loudness, 0..1. Default 0.8. */
  level?: number;
  /** Start talking immediately. Default true. */
  speaking?: boolean;
}

/**
 * Deterministic, speech-like audio with no microphone, permissions or
 * AudioContext. Syllable-rate pulses, phrase pauses and moving formants. Use it
 * for docs previews, tests, and simulating an agent that is "speaking".
 */
export class SyntheticSignal extends BaseAudioSignal {
  level: number;
  speaking: boolean;
  private readonly seed: number;
  private clock = 0;

  constructor(options: SyntheticSignalOptions = {}) {
    super(options.binCount ?? 128, options.sampleRate ?? 48000);
    this.seed = options.seed ?? 1;
    this.level = options.level ?? 0.8;
    this.speaking = options.speaking ?? true;
  }

  protected sample(delta: number): void {
    this.clock += delta;
    const t = this.clock;
    const syllable = valueNoise(t * 4.5, this.seed) ** 1.5;
    const phrase = smoothstep(0.3, 0.45, valueNoise(t * 0.6, this.seed + 7));
    const target = this.speaking ? this.level * phrase * (0.25 + 0.75 * syllable) : 0;
    this.volume = envelope(this.volume, target, 25, 8, delta);

    fillVoiceSpectrum(this.frequency, this.sampleRate, this.volume, t, this.seed);
    fillVoiceWaveform(this.waveform, this.sampleRate, this.volume, t);
  }
}
