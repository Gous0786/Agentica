"use client";

import { useEffect } from "react";
import {
  type FrameCallback,
  type FrameSubscribeOptions,
  frameLoop,
} from "@/lib/agentica/core/frame-loop";
import { useLatest } from "@/lib/agentica/hooks/use-latest";

export interface UseFrameOptions extends FrameSubscribeOptions {
  /** Subscribe only while true. Default `true`. */
  active?: boolean;
}

/**
 * Run `callback` on the shared frame loop. The callback can change every
 * render without resubscribing. Never set React state in here; write to refs,
 * canvases or GPU uniforms.
 */
export function useFrame(
  callback: FrameCallback,
  { active = true, priority, maxFps }: UseFrameOptions = {},
): void {
  const latest = useLatest(callback);
  useEffect(() => {
    if (!active) return;
    return frameLoop.subscribe((info) => latest.current(info), { priority, maxFps });
  }, [active, priority, maxFps, latest]);
}
