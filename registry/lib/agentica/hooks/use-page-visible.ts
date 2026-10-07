"use client";

import { useSyncExternalStore } from "react";
import { pageVisibleStore } from "@/lib/agentica/core/env";

/** `false` while the browser tab is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    pageVisibleStore.subscribe,
    pageVisibleStore.getSnapshot,
    pageVisibleStore.getServerSnapshot,
  );
}
