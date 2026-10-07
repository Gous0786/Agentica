"use client";

import { useSyncExternalStore } from "react";
import { reducedMotionStore } from "@/lib/agentica/core/env";
import { useAgenticaConfig } from "@/lib/agentica/core/provider";

/** Whether motion should be reduced: the OS setting, unless the provider overrides it. */
export function useReducedMotion(): boolean {
  const { reducedMotion } = useAgenticaConfig();
  const prefersReduced = useSyncExternalStore(
    reducedMotionStore.subscribe,
    reducedMotionStore.getSnapshot,
    reducedMotionStore.getServerSnapshot,
  );
  if (reducedMotion === "always") return true;
  if (reducedMotion === "never") return false;
  return prefersReduced;
}
