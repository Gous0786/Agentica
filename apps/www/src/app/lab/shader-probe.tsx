"use client";

import { useRef } from "react";
import {
  AGENT_STATE_COLOR_VARS,
  AGENT_STATES,
  type AgentState,
  stateWeights,
} from "@/lib/agentica/agent/states";
import { useStateParams } from "@/lib/agentica/agent/use-state-params";
import { type AudioReactiveProps, useAudioSignal } from "@/lib/agentica/audio/use-audio-signal";
import { blendColors } from "@/lib/agentica/color/color";
import { useColors } from "@/lib/agentica/color/use-colors";
import type { VisualProps } from "@/lib/agentica/core/types";
import { cn } from "@/lib/agentica/core/utils";
import { useVisualRuntime } from "@/lib/agentica/hooks/use-visual-runtime";
import { COLOR_GLSL } from "@/lib/agentica/webgl/glsl/color";
import { NOISE_GLSL } from "@/lib/agentica/webgl/glsl/noise";
import { FRAGMENT_PRELUDE, glsl } from "@/lib/agentica/webgl/glsl/prelude";
import { useShader } from "@/lib/agentica/webgl/use-shader";

/**
 * Reference implementation of the visual-component contract, written the way a
 * registry component should be. It is NOT a library component.
 */

const FRAGMENT = glsl`${FRAGMENT_PRELUDE}
${NOISE_GLSL}
${COLOR_GLSL}
uniform float uPhase;
uniform float uScale;
uniform float uIntensity;
uniform float uVolume;
uniform vec4 uColor;
uniform vec4 uBackground;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float n = fbm(vec3(uv * uScale * 2.0, uPhase), 4) * 0.5 + 0.5;
  float radius = 0.32 + uVolume * 0.12 + n * 0.08;
  float body = smoothstep(radius, radius - 0.18, length(uv));
  float energy = clamp(body * (uIntensity + uVolume * 0.6) * (0.6 + n), 0.0, 1.0);
  vec3 color = mixOklab(toLinear(uBackground.rgb), toLinear(uColor.rgb), energy);
  fragColor = vec4(toSrgb(color) + dither(gl_FragCoord.xy), 1.0);
}`;

// Static presets at module scope: stable, and readable as a table.
const PRESETS = {
  idle: { speed: 0.12, scale: 1.0, intensity: 0.35, weights: stateWeights("idle") },
  connecting: { speed: 0.6, scale: 1.4, intensity: 0.5, weights: stateWeights("connecting") },
  listening: { speed: 0.3, scale: 1.1, intensity: 0.6, weights: stateWeights("listening") },
  thinking: { speed: 1.1, scale: 2.2, intensity: 0.75, weights: stateWeights("thinking") },
  speaking: { speed: 0.45, scale: 1.2, intensity: 0.55, weights: stateWeights("speaking") },
  error: { speed: 0.08, scale: 0.8, intensity: 0.9, weights: stateWeights("error") },
} satisfies Record<AgentState, unknown>;

const COLOR_INPUTS = { background: "--agentica-background", ...AGENT_STATE_COLOR_VARS };

export interface ShaderProbeProps extends VisualProps, AudioReactiveProps {
  state?: AgentState;
}

export function ShaderProbe({
  state = "idle",
  audio,
  className,
  style,
  ...visual
}: ShaderProbeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. One gate decides whether we animate at all.
  const runtime = useVisualRuntime(rootRef, visual);
  // 2. Inputs: audio (sampled only while active), tweened params, theme colors.
  const signal = useAudioSignal(audio, { active: runtime.active });
  const params = useStateParams(state, PRESETS, { immediate: !runtime.active });
  const colors = useColors(rootRef, COLOR_INPUTS);
  // 3. Per-frame scratch state lives in refs. Never in React state.
  // Resolved color arrays are stable (updated in place on theme change), so collect them once.
  const scratch = useRef({
    phase: 0,
    color: new Float32Array(4),
    stateColors: AGENT_STATES.map((name) => colors.current[name]),
  });

  const status = useShader(canvasRef, {
    runtime,
    fragment: FRAGMENT,
    uniforms: ({ uniforms, delta }) => {
      params.update(delta);
      const { speed, scale, intensity, weights } = params.values;
      const s = scratch.current;
      // Integrate speed into a phase so speed changes never make time jump.
      s.phase += delta * speed;
      blendColors(s.color, s.stateColors, weights);

      uniforms.set("uPhase", s.phase);
      uniforms.set("uScale", scale);
      uniforms.set("uIntensity", intensity);
      uniforms.set("uVolume", signal.volume);
      uniforms.set("uColor", s.color);
      uniforms.set("uBackground", colors.current.background);
    },
  });

  return (
    <div
      ref={rootRef}
      className={cn("relative overflow-hidden rounded-xl", className)}
      style={style}
      data-status={status}
    >
      {/* 4. CSS fallback: visible during SSR, before WebGL is ready, and when unsupported. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          "bg-[radial-gradient(circle,var(--agentica-primary)_0%,transparent_45%)] opacity-40",
          status === "ready" && "opacity-0",
        )}
      />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
    </div>
  );
}
