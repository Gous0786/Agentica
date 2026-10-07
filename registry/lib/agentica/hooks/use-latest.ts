import { type RefObject, useRef } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/agentica/hooks/use-isomorphic-layout-effect";

/**
 * A ref that always holds the latest `value`. Lets long-lived callbacks
 * (frame loops, observers) read fresh props without resubscribing.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
