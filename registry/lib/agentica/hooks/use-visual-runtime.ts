"use client";

import type { RefObject } from "react";
import { useAgenticaConfig } from "@/lib/agentica/core/provider";
import type { VisualProps } from "@/lib/agentica/core/types";
import { useInView } from "@/lib/agentica/hooks/use-in-view";
import { usePageVisible } from "@/lib/agentica/hooks/use-page-visible";
import { useReducedMotion } from "@/lib/agentica/hooks/use-reduced-motion";

export interface VisualRuntime {
  /** True when the visual should be animating right now. */
  active: boolean;
  /** Render a single static frame instead of animating. */
  reducedMotion: boolean;
  /** Effective frame rate cap (0 = uncapped). */
  maxFps: number;
  /** Effective device pixel ratio cap. */
  maxDpr: number;
}

/**
 * The single gate every visual goes through. It combines the visual's own props
 * with provider config, reduced motion, tab visibility and viewport visibility
 * into one answer: should this visual animate, and how expensively?
 */
export function useVisualRuntime(
  ref: RefObject<Element | null>,
  { paused = false, maxFps, maxDpr }: Pick<VisualProps, "paused" | "maxFps" | "maxDpr"> = {},
): VisualRuntime {
  const config = useAgenticaConfig();
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisible();
  const inView = useInView(ref, { rootMargin: config.offscreenMargin });

  return {
    active: inView && pageVisible && !paused && !config.paused && !reducedMotion,
    reducedMotion,
    maxFps: minCap(config.maxFps, maxFps ?? 0),
    maxDpr: Math.min(config.maxDpr, maxDpr ?? Number.POSITIVE_INFINITY),
  };
}

/** Lowest non-zero cap, where 0 means "no cap". */
function minCap(a: number, b: number): number {
  if (a <= 0) return b;
  if (b <= 0) return a;
  return Math.min(a, b);
}
