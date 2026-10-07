/**
 * Type-reflected uniform setter. It asks the linked program what each uniform's
 * GLSL type is, so callers just pass numbers or arrays: no `uniform3fv`
 * bookkeeping, and no errors for uniforms the compiler optimised away.
 */

export type UniformValue = number | boolean | Float32Array | Int32Array | readonly number[];

export interface UniformSetter {
  set(name: string, value: UniformValue): void;
  has(name: string): boolean;
}

interface UniformInfo {
  location: WebGLUniformLocation;
  type: number;
  /** >1 for arrays, e.g. `uniform float uBands[32]`. */
  size: number;
}

export function createUniformSetter(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): UniformSetter {
  const uniforms = new Map<string, UniformInfo>();
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const location = gl.getUniformLocation(program, info.name);
    if (!location) continue;
    // Arrays reflect as "uName[0]"; expose them as "uName".
    uniforms.set(info.name.replace(/\[0\]$/, ""), { location, type: info.type, size: info.size });
  }

  return {
    has: (name) => uniforms.has(name),
    set(name, value) {
      const u = uniforms.get(name);
      if (!u) return;
      const { location: l, type } = u;

      if (typeof value === "number" || typeof value === "boolean") {
        const n = Number(value);
        if (type === gl.FLOAT) gl.uniform1f(l, n);
        else if (type === gl.INT || type === gl.BOOL || isSampler(gl, type)) gl.uniform1i(l, n);
        else if (type === gl.UNSIGNED_INT) gl.uniform1ui(l, n);
        else warnOnce(name, "received a number for a vector/matrix uniform; pass an array.");
        return;
      }

      const v = value as Float32List & Int32List;
      switch (type) {
        case gl.FLOAT:
          return gl.uniform1fv(l, v);
        case gl.FLOAT_VEC2:
          return gl.uniform2fv(l, v);
        case gl.FLOAT_VEC3:
          return gl.uniform3fv(l, v);
        case gl.FLOAT_VEC4:
          return gl.uniform4fv(l, v);
        case gl.INT:
        case gl.BOOL:
          return gl.uniform1iv(l, v);
        case gl.INT_VEC2:
        case gl.BOOL_VEC2:
          return gl.uniform2iv(l, v);
        case gl.INT_VEC3:
        case gl.BOOL_VEC3:
          return gl.uniform3iv(l, v);
        case gl.INT_VEC4:
        case gl.BOOL_VEC4:
          return gl.uniform4iv(l, v);
        case gl.FLOAT_MAT2:
          return gl.uniformMatrix2fv(l, false, v);
        case gl.FLOAT_MAT3:
          return gl.uniformMatrix3fv(l, false, v);
        case gl.FLOAT_MAT4:
          return gl.uniformMatrix4fv(l, false, v);
        default:
          warnOnce(name, `has unsupported uniform type 0x${type.toString(16)}.`);
      }
    },
  };
}

function isSampler(gl: WebGL2RenderingContext, type: number): boolean {
  return (
    type === gl.SAMPLER_2D ||
    type === gl.SAMPLER_3D ||
    type === gl.SAMPLER_CUBE ||
    type === gl.SAMPLER_2D_ARRAY
  );
}

const warned = new Set<string>();
function warnOnce(name: string, message: string) {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[agentica] uniform "${name}" ${message}`);
}
