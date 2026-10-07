"use client";

import { type RefObject, useEffect, useRef } from "react";
import { type CanvasSize, useCanvasSize } from "@/lib/agentica/canvas/use-canvas-size";
import { type FrameInfo, FramePriority } from "@/lib/agentica/core/frame-loop";
import { useFrame } from "@/lib/agentica/hooks/use-frame";
import { useLatest } from "@/lib/agentica/hooks/use-latest";
import type { VisualRuntime } from "@/lib/agentica/hooks/use-visual-runtime";

export interface Canvas2DFrame extends FrameInfo {
  ctx: CanvasRenderingContext2D;
  /** The context is pre-scaled by `size.dpr`: draw in CSS pixels. */
  size: CanvasSize;
}

export interface UseCanvas2DOptions {
  runtime: VisualRuntime;
  draw: (frame: Canvas2DFrame) => void;
  /** Local clock value used before the first animated frame (and for reduced motion). */
  staticTime?: number;
  contextAttributes?: CanvasRenderingContext2DSettings;
}

/**
 * Drive a 2D canvas from the shared frame loop. Time is local to this visual,
 * so pausing and resuming continues smoothly. While inactive it still repaints
 * a static frame on resize, so reduced-motion users get a correct still image.
 */
export function useCanvas2D(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { runtime, draw, staticTime = 0, contextAttributes }: UseCanvas2DOptions,
): void {
  const drawRef = useLatest(draw);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const clock = useRef({ time: staticTime, frame: 0 });

  const paint = (delta: number, frame: number) => {
    const ctx = ctxRef.current;
    const size = sizeRef.current;
    if (!ctx || size.pixelWidth === 0) return;
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    drawRef.current({ ctx, size, time: clock.current.time, delta, frame });
  };
  const paintRef = useLatest(paint);

  const sizeRef = useCanvasSize(canvasRef, {
    maxDpr: runtime.maxDpr,
    // Resizing clears the canvas; repaint immediately so there's no blank frame.
    onResize: () => paintRef.current(0, clock.current.frame),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: context attributes are fixed for a canvas's lifetime, so read them once.
  useEffect(() => {
    ctxRef.current = canvasRef.current?.getContext("2d", contextAttributes) ?? null;
    paintRef.current(0, clock.current.frame);
  }, [canvasRef, paintRef]);

  // While not animating, every render (new props, state change) repaints the still frame.
  useEffect(() => {
    if (!runtime.active) paintRef.current(0, clock.current.frame);
  });

  useFrame(
    ({ delta, frame }) => {
      clock.current.time += delta;
      clock.current.frame = frame;
      paintRef.current(delta, frame);
    },
    { active: runtime.active, maxFps: runtime.maxFps, priority: FramePriority.render },
  );
}
