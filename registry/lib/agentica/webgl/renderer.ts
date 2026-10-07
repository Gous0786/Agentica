import { createProgram } from "@/lib/agentica/webgl/program";
import { createUniformSetter, type UniformSetter } from "@/lib/agentica/webgl/uniforms";

/**
 * Covers the viewport with one triangle generated from `gl_VertexID`: no
 * buffers, no attributes. `vUv` is 0..1 across the canvas.
 */
export const FULLSCREEN_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Lean defaults for full-screen effects: no depth/stencil/MSAA. Output premultiplied alpha. */
export const DEFAULT_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: "default",
};

export interface RenderParams {
  time: number;
  delta: number;
  dpr: number;
  setUniforms?: (uniforms: UniformSetter) => void;
}

/**
 * Framework-agnostic full-screen fragment shader runner. Built-in uniforms:
 * `uTime` (s), `uDelta` (s), `uResolution` (vec2, backing pixels) and `uDpr`.
 */
export class ShaderRenderer {
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private setter: UniformSetter | null = null;
  private fragment: string;
  private readonly vertex: string;
  private readonly resolution = new Float32Array(2);

  /** Returns `null` when WebGL2 is unavailable, so callers can keep their fallback. */
  static create(
    canvas: HTMLCanvasElement,
    fragment: string,
    options: { vertex?: string; contextAttributes?: WebGLContextAttributes } = {},
  ): ShaderRenderer | null {
    const gl = canvas.getContext("webgl2", {
      ...DEFAULT_CONTEXT_ATTRIBUTES,
      ...options.contextAttributes,
    });
    return gl ? new ShaderRenderer(gl, fragment, options.vertex ?? FULLSCREEN_VERTEX) : null;
  }

  private constructor(gl: WebGL2RenderingContext, fragment: string, vertex: string) {
    this.gl = gl;
    this.fragment = fragment;
    this.vertex = vertex;
    this.build();
  }

  /** Swap the fragment shader. Throws `ShaderCompileError` and keeps the previous program on failure. */
  setFragment(fragment: string): void {
    if (fragment === this.fragment && this.program) return;
    const previous = this.fragment;
    this.fragment = fragment;
    try {
      this.build();
    } catch (error) {
      this.fragment = previous;
      throw error;
    }
  }

  /** Rebuild GPU resources after `webglcontextrestored`. */
  restore(): void {
    this.program = null;
    this.vao = null;
    this.build();
  }

  render({ time, delta, dpr, setUniforms }: RenderParams): void {
    const { gl } = this;
    if (!this.program || !this.setter || gl.isContextLost()) return;
    const { width, height } = gl.canvas;
    this.resolution[0] = width;
    this.resolution[1] = height;

    gl.viewport(0, 0, width, height);
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
    gl.useProgram(this.program);
    this.setter.set("uTime", time);
    this.setter.set("uDelta", delta);
    this.setter.set("uDpr", dpr);
    this.setter.set("uResolution", this.resolution);
    setUniforms?.(this.setter);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const { gl } = this;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.program = null;
    this.vao = null;
    this.setter = null;
    // Deliberately NOT calling WEBGL_lose_context: React StrictMode remounts reuse
    // the same canvas, and a force-lost context can't be used again.
  }

  private build() {
    const { gl } = this;
    const program = createProgram(gl, this.vertex, this.fragment);
    if (this.program) gl.deleteProgram(this.program);
    this.program = program;
    this.setter = createUniformSetter(gl, program);
    this.vao ??= gl.createVertexArray();
  }
}
