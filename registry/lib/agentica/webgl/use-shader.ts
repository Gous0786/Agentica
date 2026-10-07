"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { type CanvasSize, useCanvasSize } from "@/lib/agentica/canvas/use-canvas-size";
import { type FrameInfo, FramePriority } from "@/lib/agentica/core/frame-loop";
import { useFrame } from "@/lib/agentica/hooks/use-frame";
import { useLatest } from "@/lib/agentica/hooks/use-latest";
import type { VisualRuntime } from "@/lib/agentica/hooks/use-visual-runtime";
import { ShaderRenderer } from "@/lib/agentica/webgl/renderer";
import type { UniformSetter } from "@/lib/agentica/webgl/uniforms";

export interface ShaderFrame extends FrameInfo {
  uniforms: UniformSetter;
  size: CanvasSize;
}

/**
 * - `loading`: before the first frame; show your CSS fallback.
 * - `ready`: drawing.
 * - `unsupported`: no WebGL2; keep the fallback.
 * - `error`: the shader failed to compile (details in the console / `onError`).
 * - `lost`: the GPU context was lost; resumes automatically if restored.
 */
export type ShaderStatus = "loading" | "ready" | "unsupported" | "error" | "lost";

export interface UseShaderOptions {
  runtime: VisualRuntime;
  /** Full fragment source. Start it with `FRAGMENT_PRELUDE`. */
  fragment: string;
  /** Set custom uniforms. Runs before every draw, including static frames. */
  uniforms?: (frame: ShaderFrame) => void;
  /** Local clock value before the first animated frame (and for reduced motion). */
  staticTime?: number;
  contextAttributes?: WebGLContextAttributes;
  onError?: (error: unknown) => void;
}

/**
 * Run a full-screen fragment shader on a canvas from the shared frame loop.
 * Handles DPR sizing, context loss/restore, hot shader swaps, StrictMode and
 * cleanup. Returns a status so the component can fade from its CSS fallback.
 */
export function useShader(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { runtime, fragment, uniforms, staticTime = 0, contextAttributes, onError }: UseShaderOptions,
): ShaderStatus {
  const [status, setStatus] = useState<ShaderStatus>("loading");
  const rendererRef = useRef<ShaderRenderer | null>(null);
  const clock = useRef({ time: staticTime, frame: 0 });
  const uniformsRef = useLatest(uniforms);
  const onErrorRef = useLatest(onError);

  const draw = (delta: number) => {
    const renderer = rendererRef.current;
    const size = sizeRef.current;
    if (!renderer || size.pixelWidth === 0) return;
    const { time, frame } = clock.current;
    renderer.render({
      time,
      delta,
      dpr: size.dpr,
      setUniforms: (setter) =>
        uniformsRef.current?.({ uniforms: setter, size, time, delta, frame }),
    });
  };
  const drawRef = useLatest(draw);

  const sizeRef = useCanvasSize(canvasRef, {
    maxDpr: runtime.maxDpr,
    onResize: () => drawRef.current(0),
  });

  const fail = (error: unknown) => {
    setStatus("error");
    if (onErrorRef.current) onErrorRef.current(error);
    else console.error(error);
  };
  const failRef = useLatest(fail);

  // Create the renderer and wire context loss. Recreated only if the canvas changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fragment & attributes are applied once here; fragment changes are handled by the effect below.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: ShaderRenderer | null;
    try {
      renderer = ShaderRenderer.create(canvas, fragment, { contextAttributes });
    } catch (error) {
      failRef.current(error);
      return;
    }
    if (!renderer) {
      setStatus("unsupported");
      return;
    }
    rendererRef.current = renderer;
    setStatus("ready");
    drawRef.current(0);

    const onLost = (event: Event) => {
      event.preventDefault(); // Signals we intend to restore.
      setStatus("lost");
    };
    const onRestored = () => {
      try {
        renderer.restore();
        setStatus("ready");
        drawRef.current(0);
      } catch (error) {
        failRef.current(error);
      }
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef, drawRef, failRef]);

  // Hot-swap the shader when the source changes (e.g. a prop selects a variant).
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    try {
      renderer.setFragment(fragment);
      setStatus("ready");
      drawRef.current(0);
    } catch (error) {
      failRef.current(error);
    }
  }, [fragment, drawRef, failRef]);

  // While not animating, every render repaints the still frame with fresh uniforms.
  useEffect(() => {
    if (!runtime.active) drawRef.current(0);
  });

  useFrame(
    ({ delta, frame }) => {
      clock.current.time += delta;
      clock.current.frame = frame;
      drawRef.current(delta);
    },
    {
      active: runtime.active && status === "ready",
      maxFps: runtime.maxFps,
      priority: FramePriority.render,
    },
  );

  return status;
}
