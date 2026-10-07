import { describe, expect, it } from "vitest";
import { parseColor, resolveColor } from "@/lib/agentica/color/color";

describe("parseColor", () => {
  it("parses hex forms", () => {
    expect(parseColor("#fff")).toEqual([1, 1, 1, 1]);
    expect(parseColor("#ff000080")[3]).toBeCloseTo(128 / 255);
    expect(parseColor("#3366cc").map((v) => Math.round(v * 255))).toEqual([51, 102, 204, 255]);
  });

  it("parses rgb() forms", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual([1, 0, 0, 1]);
    expect(parseColor("rgb(0 255 0 / 50%)")).toEqual([0, 1, 0, 0.5]);
    expect(parseColor("rgba(0,0,255,0.25)")).toEqual([0, 0, 1, 0.25]);
  });

  it("returns transparent for unparseable input without a canvas", () => {
    expect(parseColor("not-a-color")).toEqual([0, 0, 0, 0]);
  });
});

describe("resolveColor", () => {
  it("reads custom properties from an element", () => {
    const el = document.createElement("div");
    el.style.setProperty("--brand", "#00ff00");
    document.body.append(el);
    expect(resolveColor("--brand", el)).toEqual([0, 1, 0, 1]);
    expect(resolveColor("var(--brand)", el)).toEqual([0, 1, 0, 1]);
    el.remove();
  });
});
