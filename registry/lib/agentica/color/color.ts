/**
 * Turn any CSS color (hex, rgb(), oklch(), color-mix(), named, or a
 * `--custom-property`) into sRGB floats for canvas and shader code.
 */

/** sRGB components and alpha, each 0..1. */
export type RGBA = [r: number, g: number, b: number, a: number];

const cache = new Map<string, RGBA>();
const CACHE_LIMIT = 256;
let probe: CanvasRenderingContext2D | null | undefined;

/** Parse a concrete CSS color. Unparseable input returns transparent black. */
export function parseColor(input: string): RGBA {
  const key = input.trim();
  const cached = cache.get(key);
  if (cached) return cached;

  const rgba = parseFast(key) ?? parseWithCanvas(key) ?? [0, 0, 0, 0];
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, rgba);
  return rgba;
}

/**
 * Resolve `--name`, `var(--name)` or a plain color against `element`'s computed
 * style. Custom properties come back with `var()` already substituted.
 */
export function resolveColor(input: string, element?: Element | null): RGBA {
  const name = input.startsWith("--") ? input : /^var\(\s*(--[\w-]+)\s*\)$/.exec(input)?.[1];
  if (!name) return parseColor(input);
  if (typeof getComputedStyle !== "function") return [0, 0, 0, 0];
  const target = element ?? document.documentElement;
  return parseColor(getComputedStyle(target).getPropertyValue(name));
}

/**
 * Weighted blend of colors into `out` (no allocation). Weights are normalized,
 * so tweened one-hot weights cross-fade cleanly.
 */
export function blendColors(
  out: Float32Array,
  colors: readonly ArrayLike<number>[],
  weights: ArrayLike<number>,
): Float32Array {
  out.fill(0);
  let total = 0;
  for (let i = 0; i < colors.length; i++) {
    const w = Math.max(weights[i] ?? 0, 0);
    if (w === 0) continue;
    total += w;
    const c = colors[i]!;
    for (let k = 0; k < out.length; k++) out[k]! += (c[k] ?? 0) * w;
  }
  if (total > 0) for (let k = 0; k < out.length; k++) out[k]! /= total;
  return out;
}

/** Format sRGBA floats for canvas 2D / CSS: `rgb(r g b / a)`. */
export function toCssColor(rgba: ArrayLike<number>, alpha = 1): string {
  const r = Math.round((rgba[0] ?? 0) * 255);
  const g = Math.round((rgba[1] ?? 0) * 255);
  const b = Math.round((rgba[2] ?? 0) * 255);
  return `rgb(${r} ${g} ${b} / ${(rgba[3] ?? 1) * alpha})`;
}

/** sRGB (0..1) to linear light: for blending math done on the CPU. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseFast(value: string): RGBA | null {
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (!/^[\da-f]+$/i.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      const c = [...hex].map((h) => Number.parseInt(h + h, 16) / 255);
      return [c[0]!, c[1]!, c[2]!, c[3] ?? 1];
    }
    if (hex.length === 6 || hex.length === 8) {
      const c = hex.match(/../g)!.map((h) => Number.parseInt(h, 16) / 255);
      return [c[0]!, c[1]!, c[2]!, c[3] ?? 1];
    }
    return null;
  }
  // rgb(1 2 3), rgb(1, 2, 3), rgba(1 2 3 / 0.5), with numbers (not percentages).
  const rgb =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(value);
  if (rgb) {
    const alpha = rgb[4];
    const a =
      alpha === undefined
        ? 1
        : alpha.endsWith("%")
          ? Number.parseFloat(alpha) / 100
          : Number(alpha);
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255, a];
  }
  return null;
}

const SENTINEL = "#010203";

/** Let the browser resolve any modern syntax by painting one pixel. */
function parseWithCanvas(value: string): RGBA | null {
  if (probe === undefined) {
    probe =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  }
  if (!probe || !value) return null;
  // Invalid colors are ignored by the setter, leaving the sentinel in place.
  probe.fillStyle = SENTINEL;
  probe.fillStyle = value;
  if (probe.fillStyle === SENTINEL && value.toLowerCase() !== SENTINEL) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  if (a === 0) return [0, 0, 0, 0];
  // getImageData is premultiplied-then-unpremultiplied; good to ~1/255.
  return [r! / 255, g! / 255, b! / 255, a! / 255];
}
