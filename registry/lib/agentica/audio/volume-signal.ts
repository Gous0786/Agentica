import { BaseAudioSignal } from "@/lib/agentica/audio/signal";
import { fillVoiceSpectrum, fillVoiceWaveform } from "@/lib/agentica/audio/voice-spectrum";
import { clamp, envelope } from "@/lib/agentica/core/math";

export interface VolumeSignalOptions {
  binCount?: number;
  /** Envelope rise/fall rates (1/s). Default 30 / 8. */
  attack?: number;
  release?: number;
  seed?: number;
}

/**
 * Adapts a plain 0..1 volume getter into a full `AudioSignal`. Many voice SDKs
 * expose only a level (e.g. an "output volume" or "track volume" API), so
 * frequency/waveform data is synthesized from it for spectrum-style visuals.
 *
 * @example new VolumeSignal(() => conversation.getOutputVolume())
 */
export class VolumeSignal extends BaseAudioSignal {
  private clock = 0;
  private readonly attack: number;
  private readonly release: number;
  private readonly seed: number;

  constructor(
    private readonly getVolume: () => number,
    options: VolumeSignalOptions = {},
  ) {
    super(options.binCount ?? 64, 48000);
    this.attack = options.attack ?? 30;
    this.release = options.release ?? 8;
    this.seed = options.seed ?? 3;
  }

  protected sample(delta: number): void {
    this.clock += delta;
    const target = clamp(Number(this.getVolume()) || 0);
    this.volume = envelope(this.volume, target, this.attack, this.release, delta);
    fillVoiceSpectrum(this.frequency, this.sampleRate, this.volume, this.clock, this.seed);
    fillVoiceWaveform(this.waveform, this.sampleRate, this.volume, this.clock);
  }
}
