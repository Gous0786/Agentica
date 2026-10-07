"use client";

import { useState } from "react";
import {
  type ParamRecord,
  ParamTween,
  type ParamTweenOptions,
} from "@/lib/agentica/agent/param-tween";
import { useIsomorphicLayoutEffect } from "@/lib/agentica/hooks/use-isomorphic-layout-effect";

export interface UseStateParamsOptions<P extends ParamRecord> extends ParamTweenOptions<P> {
  /** Jump instead of animating. Pass `!runtime.active` so paused/reduced-motion visuals update instantly. */
  immediate?: boolean;
}

/**
 * Map a discrete state to a set of numeric params and tween between them.
 * Call `tween.update(delta)` in your frame callback, then read `tween.values`.
 * Transitions are fixed at mount.
 *
 * @example
 * const params = useStateParams(state, {
 *   idle:     { speed: 0.2, glow: 0.3, color: [0.5, 0.5, 0.6, 1] },
 *   thinking: { speed: 1.2, glow: 0.6, color: [0.6, 0.4, 1.0, 1] },
 *   ...
 * }, { immediate: !runtime.active });
 */
export function useStateParams<S extends string, P extends ParamRecord>(
  state: S,
  presets: Record<S, P>,
  { immediate = false, ...tweenOptions }: UseStateParamsOptions<P> = {},
): ParamTween<P> {
  const [tween] = useState(() => new ParamTween(presets[state], tweenOptions));
  // Presets are often inline literals; compare by content, not identity.
  const target = presets[state];
  const targetKey = JSON.stringify(target);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `targetKey` stands in for `target`.
  useIsomorphicLayoutEffect(() => {
    tween.setTarget(target);
    if (immediate) tween.snap();
  }, [tween, targetKey, immediate]);

  return tween;
}
