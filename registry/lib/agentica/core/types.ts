import type { CSSProperties } from "react";

/**
 * Props every animated Agentica visual accepts. Extend this in component props
 * so performance controls work the same way everywhere.
 */
export interface VisualProps {
  className?: string;
  style?: CSSProperties;
  /** Freeze on the current frame. */
  paused?: boolean;
  /** Cap this visual's frame rate. Combined with the provider cap (lowest wins). */
  maxFps?: number;
  /** Cap device pixel ratio for this visual's canvas. Combined with the provider cap. */
  maxDpr?: number;
}
