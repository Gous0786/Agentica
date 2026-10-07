"use client";

import { useRef, useState } from "react";
import { AGENT_STATE_COLOR_VARS, type AgentState } from "@/lib/agentica/agent/states";
import { computeBands } from "@/lib/agentica/audio/bands";
import { type AudioReactiveProps, useAudioSignal } from "@/lib/agentica/audio/use-audio-signal";
import { useCanvas2D } from "@/lib/agentica/canvas/use-canvas-2d";
import { toCssColor } from "@/lib/agentica/color/color";
import { useColors } from "@/lib/agentica/color/use-colors";
import type { VisualProps } from "@/lib/agentica/core/types";
import { cn } from "@/lib/agentica/core/utils";
import { useVisualRuntime } from "@/lib/agentica/hooks/use-visual-runtime";

/** Canvas 2D reference probe: spectrum bands, waveform and volume. Not a library component. */
export interface SignalScopeProps extends VisualProps, AudioReactiveProps {
  state?: AgentState;
  bands?: number;
}

export function SignalScope({
  state = "idle",
  audio,
  bands = 48,
  className,
  style,
  ...visual
}: SignalScopeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtime = useVisualRuntime(rootRef, visual);
  const signal = useAudioSignal(audio, { active: runtime.active });
  const colors = useColors(rootRef, {
    accent: AGENT_STATE_COLOR_VARS[state],
    fg: "--agentica-foreground",
  });
  const [bandData] = useState(() => new Float32Array(bands));

  useCanvas2D(canvasRef, {
    runtime,
    draw: ({ ctx, size }) => {
      const { width, height } = size;
      const accent = colors.current.accent;
      ctx.clearRect(0, 0, width, height);

      // Spectrum bands.
      computeBands(signal, bandData);
      const gap = 2;
      const barWidth = (width - gap * (bandData.length - 1)) / bandData.length;
      ctx.fillStyle = toCssColor(accent, 0.85);
      for (let i = 0; i < bandData.length; i++) {
        const h = Math.max(2, bandData[i]! * (height - 24));
        ctx.fillRect(i * (barWidth + gap), height - 12 - h, barWidth, h);
      }

      // Waveform.
      const wave = signal.waveform;
      ctx.strokeStyle = toCssColor(colors.current.fg, 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = (i / (wave.length - 1)) * width;
        const y = height / 2 - wave[i]! * height * 0.35;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Volume meter.
      ctx.fillStyle = toCssColor(accent);
      ctx.fillRect(0, height - 4, signal.volume * width, 4);
    },
  });

  return (
    <div ref={rootRef} className={cn("relative", className)} style={style}>
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
    </div>
  );
}
