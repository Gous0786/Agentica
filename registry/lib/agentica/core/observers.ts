/**
 * Page-wide shared observers: one ResizeObserver in total and one
 * IntersectionObserver per distinct config, instead of one per component.
 */

type ResizeCallback = (entry: ResizeObserverEntry) => void;
type IntersectionCallback = (entry: IntersectionObserverEntry) => void;

let resizeObserver: ResizeObserver | null = null;
const resizeCallbacks = new Map<Element, Set<ResizeCallback>>();

export function observeResize(element: Element, callback: ResizeCallback): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  resizeObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const callbacks = resizeCallbacks.get(entry.target);
      if (callbacks) for (const cb of callbacks) cb(entry);
    }
  });

  let callbacks = resizeCallbacks.get(element);
  if (!callbacks) {
    callbacks = new Set();
    resizeCallbacks.set(element, callbacks);
    observeWithBestBox(resizeObserver, element);
  }
  callbacks.add(callback);

  return () => {
    const set = resizeCallbacks.get(element);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) {
      resizeCallbacks.delete(element);
      resizeObserver?.unobserve(element);
    }
  };
}

function observeWithBestBox(observer: ResizeObserver, element: Element) {
  // device-pixel-content-box gives exact backing-store sizes and fires on DPR
  // changes. Safari throws on it, so fall back to content-box there.
  try {
    observer.observe(element, { box: "device-pixel-content-box" });
  } catch {
    observer.observe(element, { box: "content-box" });
  }
}

export interface IntersectionOptions {
  /** Grow the viewport so work starts slightly before an element scrolls in. */
  rootMargin?: string;
  threshold?: number;
}

interface SharedIntersection {
  observer: IntersectionObserver;
  callbacks: Map<Element, Set<IntersectionCallback>>;
}

const intersectionObservers = new Map<string, SharedIntersection>();

export function observeIntersection(
  element: Element,
  callback: IntersectionCallback,
  options: IntersectionOptions = {},
): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const rootMargin = options.rootMargin ?? "0px";
  const threshold = options.threshold ?? 0;
  const key = `${rootMargin}|${threshold}`;

  let shared = intersectionObservers.get(key);
  if (!shared) {
    const callbacks = new Map<Element, Set<IntersectionCallback>>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const set = callbacks.get(entry.target);
          if (set) for (const cb of set) cb(entry);
        }
      },
      { rootMargin, threshold },
    );
    shared = { observer, callbacks };
    intersectionObservers.set(key, shared);
  }

  let set = shared.callbacks.get(element);
  if (!set) {
    set = new Set();
    shared.callbacks.set(element, set);
    shared.observer.observe(element);
  }
  set.add(callback);

  const current = shared;
  return () => {
    const callbacks = current.callbacks.get(element);
    if (!callbacks) return;
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      current.callbacks.delete(element);
      current.observer.unobserve(element);
    }
  };
}
