"use client";

import { type RefObject, useEffect, useState } from "react";
import { type IntersectionOptions, observeIntersection } from "@/lib/agentica/core/observers";

export interface UseInViewOptions extends IntersectionOptions {
  /** Value before the first observation. Default `false`. */
  initial?: boolean;
}

/** Whether the element is within the (margin-expanded) viewport. Uses a shared observer. */
export function useInView(
  ref: RefObject<Element | null>,
  { rootMargin, threshold, initial = false }: UseInViewOptions = {},
): boolean {
  const [inView, setInView] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    return observeIntersection(element, (entry) => setInView(entry.isIntersecting), {
      rootMargin,
      threshold,
    });
  }, [ref, rootMargin, threshold]);
  return inView;
}
