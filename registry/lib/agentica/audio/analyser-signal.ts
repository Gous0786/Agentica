import { getAudioContext } from "@/lib/agentica/audio/context";
import { BaseAudioSignal } from "@/lib/agentica/audio/signal";
import { envelope, remap } from "@/lib/agentica/core/math";

/** Anything Web Audio can analyse. */
export type AudioInput = MediaStream | HTMLMediaElement | AudioNode;

export interface AnalyserSignalOptions {
  /** FFT size, a power of two. `binCount = fftSize / 2`. Default 256. */
  fftSize?: number;
  /** Analyser's own temporal smoothing, 0..1. Default 0.6. */
  smoothing?: number;
  /** dB range mapped to frequency 0..1. Default [-90, -20]. */
  decibels?: [min: number, max: number];
  /** RMS dB range mapped to volume 0..1. Default [-55, -12]. */
  volumeDecibels?: [min: number, max: number];
  /** Volume envelope rise/fall rates (1/s). Default 30 / 6. */
  attack?: number;
  release?: number;
}

// A media element can only ever have ONE MediaElementSourceNode, so cache it.
const mediaElementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

/** Real-time analysis of a stream, media element or Web Audio node. */
export class AnalyserSignal extends BaseAudioSignal {
  private readonly analyser: AnalyserNode;
  private readonly source: AudioNode;
  private readonly ownsSource: boolean;
  private readonly bytes: Uint8Array<ArrayBuffer>;
  private readonly volumeRange: [number, number];
  private readonly attack: number;
  private readonly release: number;

  constructor(input: AudioInput, options: AnalyserSignalOptions = {}) {
    // Analyse AudioNodes in their own context (e.g. a provider SDK's), else use the shared one.
    const ctx = input instanceof AudioNode ? input.context : getAudioContext();
    const fftSize = options.fftSize ?? 256;
    super(fftSize / 2, ctx.sampleRate, fftSize);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = options.smoothing ?? 0.6;
    analyser.minDecibels = options.decibels?.[0] ?? -90;
    analyser.maxDecibels = options.decibels?.[1] ?? -20;
    this.analyser = analyser;
    this.bytes = new Uint8Array(analyser.frequencyBinCount);
    this.volumeRange = options.volumeDecibels ?? [-55, -12];
    this.attack = options.attack ?? 30;
    this.release = options.release ?? 6;

    const { node, owned } = connectInput(ctx, input);
    this.source = node;
    this.ownsSource = owned;
    node.connect(analyser);
  }

  protected sample(delta: number): void {
    const { analyser, frequency, waveform, bytes } = this;
    analyser.getByteFrequencyData(bytes);
    for (let i = 0; i < frequency.length; i++) frequency[i] = bytes[i]! / 255;

    analyser.getFloatTimeDomainData(waveform);
    let sum = 0;
    for (let i = 0; i < waveform.length; i++) sum += waveform[i]! * waveform[i]!;
    const rms = Math.sqrt(sum / waveform.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    const target = remap(db, this.volumeRange[0], this.volumeRange[1], 0, 1);
    this.volume = envelope(this.volume, target, this.attack, this.release, delta);
  }

  override dispose(): void {
    super.dispose();
    try {
      this.source.disconnect(this.analyser);
    } catch {
      // Already disconnected.
    }
    if (this.ownsSource) this.source.disconnect();
  }
}

function connectInput(
  ctx: BaseAudioContext,
  input: AudioInput,
): { node: AudioNode; owned: boolean } {
  if (input instanceof AudioNode) return { node: input, owned: false };

  if (isMediaStream(input)) {
    if (input.getAudioTracks().length === 0) {
      throw new Error("[agentica] MediaStream has no audio tracks to analyse.");
    }
    // Not connected to the destination: analysing a mic must not play it back.
    return { node: (ctx as AudioContext).createMediaStreamSource(input), owned: true };
  }

  if (!(input instanceof HTMLMediaElement)) throw new Error("[agentica] Unsupported audio input.");
  let node = mediaElementSources.get(input);
  if (!node) {
    node = (ctx as AudioContext).createMediaElementSource(input);
    // Rerouting an element through Web Audio mutes it unless we reconnect the output.
    node.connect(ctx.destination);
    mediaElementSources.set(input, node);
  }
  return { node, owned: false };
}

function isMediaStream(input: AudioInput): input is MediaStream {
  return typeof MediaStream !== "undefined" && input instanceof MediaStream;
}
