import type { AudioSignal } from "@/lib/agentica/audio/signal";

export interface BandOptions {
  /** Lowest frequency included, Hz. Default 60. */
  minHz?: number;
  /** Highest frequency included, Hz. Default 8000 (covers voice). */
  maxHz?: number;
  /** `log` matches hearing and is right for almost every visual. Default `log`. */
  scale?: "log" | "linear";
  /** How bins within a band are combined. Default `average`. */
  reduce?: "average" | "max";
}

/**
 * Group a signal's FFT bins into `out.length` bands, writing into `out` in
 * place (no allocation). Bands narrower than one bin interpolate between bins,
 * so low bands are never stuck at zero.
 */
export function computeBands(
  signal: Pick<AudioSignal, "frequency" | "sampleRate">,
  out: Float32Array,
  { minHz = 60, maxHz = 8000, scale = "log", reduce = "average" }: BandOptions = {},
): Float32Array {
  const { frequency, sampleRate } = signal;
  const count = out.length;
  const binHz = sampleRate / 2 / frequency.length;
  const lo = Math.max(minHz / binHz, 0);
  const hi = Math.min(maxHz / binHz, frequency.length - 1);
  if (count === 0 || hi <= lo) {
    out.fill(0);
    return out;
  }

  for (let band = 0; band < count; band++) {
    const start = edge(band / count, lo, hi, scale);
    const end = edge((band + 1) / count, lo, hi, scale);
    const first = Math.ceil(start);
    const last = Math.floor(end);

    if (last < first) {
      out[band] = sampleAt(frequency, (start + end) / 2);
      continue;
    }
    let acc = 0;
    for (let i = first; i <= last; i++) {
      const v = frequency[i]!;
      acc = reduce === "max" ? Math.max(acc, v) : acc + v;
    }
    out[band] = reduce === "max" ? acc : acc / (last - first + 1);
  }
  return out;
}

function edge(t: number, lo: number, hi: number, scale: "log" | "linear"): number {
  if (scale === "linear") return lo + (hi - lo) * t;
  const safeLo = Math.max(lo, 1);
  return safeLo * (hi / safeLo) ** t;
}

function sampleAt(data: Float32Array, position: number): number {
  const i = Math.floor(position);
  const f = position - i;
  const a = data[i] ?? 0;
  const b = data[i + 1] ?? a;
  return a + (b - a) * f;
}
