"use client";

import { type RefObject, useRef, useSyncExternalStore } from "react";
import { resolveColor } from "@/lib/agentica/color/color";
import { themeStore } from "@/lib/agentica/color/theme-store";
import { useIsomorphicLayoutEffect } from "@/lib/agentica/hooks/use-isomorphic-layout-effect";

export type ResolvedColors<K extends string> = Record<K, Float32Array>;

/**
 * Resolve named colors (CSS colors or `--variables`) to sRGBA `Float32Array(4)`s,
 * ready to pass to a `vec4` uniform or canvas code. Re-resolves when inputs or
 * the page theme change. The result is a ref, so reads in the frame loop never
 * trigger renders. Arrays are reused and updated in place.
 *
 * @example
 * const colors = useColors(ref, { base: "--agentica-primary", glow: props.glowColor ?? "--agentica-glow" });
 * // in uniforms(): uniforms.set("uBase", colors.current.base)
 */
export function useColors<K extends string>(
  ref: RefObject<Element | null>,
  colors: Record<K, string>,
): RefObject<ResolvedColors<K>> {
  const themeVersion = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );
  const resolved = useRef<ResolvedColors<K>>(null as unknown as ResolvedColors<K>);
  if (resolved.current === null) {
    resolved.current = Object.fromEntries(
      Object.keys(colors).map((key) => [key, new Float32Array(4)]),
    ) as ResolvedColors<K>;
  }

  // Stable dependency for inline object literals.
  const signature = JSON.stringify(colors);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` captures `colors`; `themeVersion` is a deliberate re-run trigger.
  useIsomorphicLayoutEffect(() => {
    const target = ref.current;
    for (const key of Object.keys(colors) as K[]) {
      // Keys added after mount get a fresh array; existing arrays update in place.
      resolved.current[key] ??= new Float32Array(4);
      resolved.current[key].set(resolveColor(colors[key], target));
    }
  }, [ref, signature, themeVersion]);

  return resolved;
}
