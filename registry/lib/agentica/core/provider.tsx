"use client";

import { createContext, type ReactNode, use, useMemo } from "react";

export type ReducedMotionSetting = "user" | "always" | "never";

export interface AgenticaConfig {
  /** `"user"` follows the OS setting. `"always"`/`"never"` override it. */
  reducedMotion: ReducedMotionSetting;
  /** Device pixel ratio cap for every canvas. */
  maxDpr: number;
  /** Frame rate cap for every visual. 0 = display refresh rate. */
  maxFps: number;
  /** Pause every visual under this provider. */
  paused: boolean;
  /** Margin around the viewport inside which visuals keep animating. */
  offscreenMargin: string;
}

export const DEFAULT_AGENTICA_CONFIG: AgenticaConfig = {
  reducedMotion: "user",
  maxDpr: 2,
  maxFps: 0,
  paused: false,
  offscreenMargin: "100px",
};

const AgenticaContext = createContext<AgenticaConfig>(DEFAULT_AGENTICA_CONFIG);

export interface AgenticaProviderProps extends Partial<AgenticaConfig> {
  children: ReactNode;
}

/**
 * Optional. Visuals work without it using `DEFAULT_AGENTICA_CONFIG`.
 * Providers nest: unset values inherit, and a paused parent pauses all children.
 */
export function AgenticaProvider({
  children,
  reducedMotion,
  maxDpr,
  maxFps,
  paused,
  offscreenMargin,
}: AgenticaProviderProps) {
  const parent = use(AgenticaContext);
  const value = useMemo<AgenticaConfig>(
    () => ({
      reducedMotion: reducedMotion ?? parent.reducedMotion,
      maxDpr: maxDpr ?? parent.maxDpr,
      maxFps: maxFps ?? parent.maxFps,
      paused: parent.paused || (paused ?? false),
      offscreenMargin: offscreenMargin ?? parent.offscreenMargin,
    }),
    [parent, reducedMotion, maxDpr, maxFps, paused, offscreenMargin],
  );
  return <AgenticaContext value={value}>{children}</AgenticaContext>;
}

export function useAgenticaConfig(): AgenticaConfig {
  return use(AgenticaContext);
}
