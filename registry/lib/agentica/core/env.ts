/**
 * Framework-agnostic external stores for browser state. Each store is created
 * lazily, shares one listener per page, and is SSR-safe (stable server value).
 * Shape matches React's `useSyncExternalStore`.
 */

export interface ExternalStore<T> {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
}

export const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export function createMediaQueryStore(query: string, serverValue = false): ExternalStore<boolean> {
  let mql: MediaQueryList | null = null;
  const get = () => {
    if (!isBrowser || typeof window.matchMedia !== "function") return null;
    mql ??= window.matchMedia(query);
    return mql;
  };
  return {
    subscribe(onChange) {
      const list = get();
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    getSnapshot: () => get()?.matches ?? serverValue,
    getServerSnapshot: () => serverValue,
  };
}

/** `true` when the user asked the OS to reduce motion. */
export const reducedMotionStore = createMediaQueryStore("(prefers-reduced-motion: reduce)");

/** `true` when the OS prefers a dark color scheme. */
export const prefersDarkStore = createMediaQueryStore("(prefers-color-scheme: dark)");

/** `true` while the tab is visible. Server renders as visible. */
export const pageVisibleStore: ExternalStore<boolean> = {
  subscribe(onChange) {
    if (!isBrowser) return () => {};
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  },
  getSnapshot: () => !isBrowser || document.visibilityState === "visible",
  getServerSnapshot: () => true,
};
