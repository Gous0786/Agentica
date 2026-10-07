"use client";

import { type RefObject, useEffect, useRef } from "react";
import { observeResize } from "@/lib/agentica/core/observers";
import { useLatest } from "@/lib/agentica/hooks/use-latest";

export interface CanvasSize {
  /** CSS pixels. */
  width: number;
  height: number;
  /** Effective pixel ratio after the cap. */
  dpr: number;
  /** Backing-store pixels. */
  pixelWidth: number;
  pixelHeight: number;
}

export const EMPTY_CANVAS_SIZE: CanvasSize = {
  width: 0,
  height: 0,
  dpr: 1,
  pixelWidth: 0,
  pixelHeight: 0,
};

/**
 * Keeps a canvas's backing store matched to its CSS size × capped DPR. The
 * canvas must be sized by CSS (e.g. `size-full`). Writes to `canvas.width`/
 * `height` only on real changes, because each write clears the canvas.
 */
export function useCanvasSize(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { maxDpr = 2, onResize }: { maxDpr?: number; onResize?: (size: CanvasSize) => void } = {},
): RefObject<CanvasSize> {
  const sizeRef = useRef<CanvasSize>(EMPTY_CANVAS_SIZE);
  const onResizeRef = useLatest(onResize);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const apply = (entry: ResizeObserverEntry | null) => {
      const deviceDpr = window.devicePixelRatio || 1;
      const dpr = Math.min(deviceDpr, maxDpr);
      const rect = entry?.contentRect ?? canvas.getBoundingClientRect();
      const exact = entry?.devicePixelContentBoxSize?.[0];
      // Prefer exact device pixels (no blur at fractional DPR), scaled by the cap.
      const pixelWidth = Math.max(
        1,
        Math.round(exact ? exact.inlineSize * (dpr / deviceDpr) : rect.width * dpr),
      );
      const pixelHeight = Math.max(
        1,
        Math.round(exact ? exact.blockSize * (dpr / deviceDpr) : rect.height * dpr),
      );

      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

      const prev = sizeRef.current;
      if (
        prev.pixelWidth === pixelWidth &&
        prev.pixelHeight === pixelHeight &&
        prev.width === rect.width &&
        prev.height === rect.height
      ) {
        return;
      }
      sizeRef.current = { width: rect.width, height: rect.height, dpr, pixelWidth, pixelHeight };
      onResizeRef.current?.(sizeRef.current);
    };

    apply(null);
    return observeResize(canvas, apply);
  }, [canvasRef, maxDpr, onResizeRef]);

  return sizeRef;
}
