/**
 * Identity tag for GLSL template literals. Editors with a GLSL plugin
 * highlight `glsl\`...\`` strings; at runtime it just joins the parts.
 */
export function glsl(strings: TemplateStringsArray, ...values: (string | number)[]): string {
  return String.raw({ raw: strings }, ...values);
}

/**
 * Standard header for fragment shaders run by `ShaderRenderer`. Declares the
 * built-in uniforms; unused ones are stripped by the compiler at no cost.
 */
export const FRAGMENT_PRELUDE = glsl`#version 300 es
precision highp float;

uniform float uTime;
uniform float uDelta;
uniform float uDpr;
uniform vec2 uResolution;

in vec2 vUv;
out vec4 fragColor;

#define PI 3.141592653589793
#define TAU 6.283185307179586
`;
