import { type ExternalStore, isBrowser, prefersDarkStore } from "@/lib/agentica/core/env";

/**
 * A counter that bumps whenever the page theme might have changed: the root
 * element's class/style/data-* attributes (class-based dark mode, theme
 * switchers) or the OS color scheme. Colors read from CSS variables should be
 * re-resolved when it changes.
 */
let version = 0;
const listeners = new Set<() => void>();
let teardown: (() => void) | null = null;

function bump() {
  version++;
  for (const listener of listeners) listener();
}

function setup() {
  const observer = new MutationObserver(bump);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-mode"],
  });
  const unsubscribeScheme = prefersDarkStore.subscribe(bump);
  return () => {
    observer.disconnect();
    unsubscribeScheme();
  };
}

export const themeStore: ExternalStore<number> = {
  subscribe(listener) {
    if (!isBrowser) return () => {};
    listeners.add(listener);
    teardown ??= setup();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        teardown?.();
        teardown = null;
      }
    };
  },
  getSnapshot: () => version,
  getServerSnapshot: () => 0,
};
