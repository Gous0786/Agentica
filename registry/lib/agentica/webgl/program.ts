/** WebGL2 program helpers with readable, line-annotated compile errors. */

export class ShaderCompileError extends Error {
  constructor(
    readonly stage: "vertex" | "fragment" | "link",
    readonly log: string,
    readonly source?: string,
  ) {
    super(`[agentica] ${stage} shader failed:\n${source ? annotate(source, log) : log}`);
    this.name = "ShaderCompileError";
  }
}

/** Print the source lines referenced by the driver log (e.g. `ERROR: 0:12:`) with context. */
function annotate(source: string, log: string): string {
  const lines = source.split("\n");
  const marked = new Set<number>();
  for (const match of log.matchAll(/ERROR:\s*\d+:(\d+)/g)) marked.add(Number(match[1]));
  if (marked.size === 0) return log;

  const out: string[] = [log.trim(), ""];
  for (const line of [...marked].sort((a, b) => a - b)) {
    for (let n = Math.max(1, line - 2); n <= Math.min(lines.length, line + 2); n++) {
      out.push(`${n === line ? ">" : " "} ${String(n).padStart(4)} | ${lines[n - 1]}`);
    }
    out.push("");
  }
  return out.join("\n");
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("[agentica] gl.createShader returned null (context lost?)");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader) ?? "";
    gl.deleteShader(shader);
    throw new ShaderCompileError(type === gl.VERTEX_SHADER ? "vertex" : "fragment", log, source);
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  let fragment: WebGLShader;
  try {
    fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  } catch (error) {
    gl.deleteShader(vertex);
    throw error;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // Shaders are no longer needed once linked.
  gl.detachShader(program, vertex);
  gl.detachShader(program, fragment);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program) ?? "";
    gl.deleteProgram(program);
    throw new ShaderCompileError("link", log);
  }
  return program;
}
