"use client";

import { useEffect, useState } from "react";
import {
  AnalyserSignal,
  type AnalyserSignalOptions,
  type AudioInput,
} from "@/lib/agentica/audio/analyser-signal";
import { type AudioSignal, isAudioSignal, silentSignal } from "@/lib/agentica/audio/signal";

/** What an audio-reactive component's `audio` prop accepts. */
export type AudioSource = AudioInput | AudioSignal | null | undefined;

export interface AudioReactiveProps {
  /**
   * Audio to react to: a `MediaStream` (mic, WebRTC track), an `<audio>`/`<video>`
   * element, a Web Audio node, or any `AudioSignal` (e.g. `SyntheticSignal`,
   * `VolumeSignal`). Omit for silence.
   */
  audio?: AudioSource;
}

export interface UseAudioSignalOptions extends AnalyserSignalOptions {
  /** Sample the signal only while true. Pass `runtime.active`. Default `true`. */
  active?: boolean;
}

/**
 * Normalize any `AudioSource` into an `AudioSignal` and keep it sampling while
 * `active`. Raw inputs get an analyser that is created on the client and
 * disposed on change/unmount; ready-made signals pass through (the caller owns
 * them). Always returns a usable signal, silent until the analyser is ready.
 */
export function useAudioSignal(
  source: AudioSource,
  { active = true, ...analyserOptions }: UseAudioSignalOptions = {},
): AudioSignal {
  const passthrough = isAudioSignal(source) ? source : null;
  const input = passthrough || !source ? null : (source as AudioInput);
  const [analysed, setAnalysed] = useState<AudioSignal | null>(null);
  const optionsKey = JSON.stringify(analyserOptions);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `optionsKey` stands in for `analyserOptions`.
  useEffect(() => {
    if (!input) {
      setAnalysed(null);
      return;
    }
    let signal: AnalyserSignal;
    try {
      signal = new AnalyserSignal(input, analyserOptions);
    } catch (error) {
      console.error(error);
      setAnalysed(null);
      return;
    }
    setAnalysed(signal);
    return () => {
      signal.dispose();
      setAnalysed(null);
    };
  }, [input, optionsKey]);

  const signal = passthrough ?? analysed ?? silentSignal;

  useEffect(() => {
    if (active) return signal.retain();
  }, [signal, active]);

  return signal;
}
