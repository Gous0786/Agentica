import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { foundationItems, type RegistryItemConfig, registry } from "../registry/registry.config";
import {
  buildRegistry,
  extractImports,
  parseCssVars,
  RegistryBuildError,
} from "../scripts/lib/registry";

const REAL_ROOT = path.resolve(__dirname, "../registry");
const baseUrl = "https://example.test";

describe("real registry", () => {
  it("builds with no problems", async () => {
    const { items, index } = await buildRegistry({
      root: REAL_ROOT,
      baseUrl,
      foundation: foundationItems,
      registryName: registry.name,
      homepage: registry.homepage,
    });
    expect(items.map((i) => i.name)).toContain("agentica-core");
    expect(index).toHaveProperty("items");
    for (const item of items) {
      for (const file of item.files) {
        expect(file.content.includes("\r")).toBe(false);
        expect(file.target).toBe(file.path.replace(/^registry\//, ""));
      }
    }
  });

  it("derives dependencies from imports", async () => {
    const { items } = await buildRegistry({
      root: REAL_ROOT,
      baseUrl,
      foundation: foundationItems,
      registryName: registry.name,
      homepage: registry.homepage,
    });
    const byName = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(byName["agentica-core"]!.dependencies).toEqual(
      expect.arrayContaining([expect.stringMatching(/^clsx@/)]),
    );
    expect(byName["agentica-webgl"]!.registryDependencies).toContain(
      `${baseUrl}/r/agentica-core.json`,
    );
    expect(byName["agentica-theme"]!.cssVars?.dark?.["agentica-primary"]).toBeTruthy();
  });
});

// ---- Fixture registries --------------------------------------------------

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

function fixture(files: Record<string, string>, deps: Record<string, string> = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "agentica-registry-"));
  dirs.push(root);
  files["package.json"] = JSON.stringify({ dependencies: deps });
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  return root;
}

const libItem: RegistryItemConfig = {
  name: "lib",
  type: "registry:lib",
  title: "Lib",
  description: "x",
  files: ["lib/agentica/core"],
};

async function problemsOf(root: string, foundation = [libItem]): Promise<string[]> {
  try {
    await buildRegistry({ root, baseUrl, foundation, registryName: "t", homepage: "t" });
    return [];
  } catch (error) {
    if (error instanceof RegistryBuildError) return error.problems;
    throw error;
  }
}

describe("build validation", () => {
  it("rejects relative imports, unknown packages and unresolved aliases", async () => {
    const root = fixture({
      "lib/agentica/core/a.ts": [
        'import { b } from "./b";',
        'import x from "left-pad";',
        'import { y } from "@/lib/agentica/core/missing";',
      ].join("\n"),
      "lib/agentica/core/b.ts": "export const b = 1;",
    });
    const problems = await problemsOf(root);
    expect(problems.some((p) => p.includes("relative import"))).toBe(true);
    expect(problems.some((p) => p.includes('"left-pad", missing from registry/package.json'))).toBe(
      true,
    );
    expect(problems.some((p) => p.includes("cannot resolve"))).toBe(true);
  });

  it("rejects files that no item publishes", async () => {
    const root = fixture({
      "lib/agentica/core/a.ts": "export const a = 1;",
      "lib/agentica/orphan/b.ts": "export const b = 1;",
    });
    expect(await problemsOf(root)).toContain(
      "lib/agentica/orphan/b.ts is not part of any registry item",
    );
  });

  it("discovers components and enforces the component contract", async () => {
    const root = fixture({
      "lib/agentica/core/a.ts": "export const a = 1;",
      "lib/agentica/hooks/use-frame.ts": "export const useFrame = () => {};",
      "lib/agentica/hooks/use-visual-runtime.ts": "export const useVisualRuntime = () => {};",
      "ui/good/meta.json": JSON.stringify({ title: "Good", description: "ok" }),
      "ui/good/good.tsx": [
        '"use client";',
        'import { useFrame } from "@/lib/agentica/hooks/use-frame";',
        'import { useVisualRuntime } from "@/lib/agentica/hooks/use-visual-runtime";',
      ].join("\n"),
      "ui/good/good.demo.tsx": "export default function Demo() {}",
      "ui/bad/meta.json": JSON.stringify({ title: "Bad", description: "no" }),
      "ui/bad/bad.tsx": 'import { useFrame } from "@/lib/agentica/hooks/use-frame";',
    });
    const foundation = [{ ...libItem, files: ["lib/agentica/core", "lib/agentica/hooks"] }];
    const problems = await problemsOf(root, foundation);
    expect(problems).toEqual(
      expect.arrayContaining([
        'ui/bad/bad.tsx: components must start with "use client"',
        "ui/bad/bad.tsx: animates without useVisualRuntime (offscreen/reduced-motion gating)",
      ]),
    );
    expect(problems.some((p) => p.startsWith("ui/good"))).toBe(false);
  });

  it("ships component files but not demos or meta, under components/agentica/", async () => {
    const root = fixture({
      "lib/agentica/core/a.ts": "export const a = 1;",
      "ui/orb/meta.json": JSON.stringify({ title: "Orb", description: "o" }),
      "ui/orb/orb.tsx": '"use client";\nimport { a } from "@/lib/agentica/core/a";',
      "ui/orb/orb.demo.tsx": "export default 1;",
    });
    const { items } = await buildRegistry({
      root,
      baseUrl,
      foundation: [libItem],
      registryName: "t",
      homepage: "t",
    });
    const orb = items.find((i) => i.name === "orb")!;
    expect(orb.files.map((f) => f.target)).toEqual(["components/agentica/orb/orb.tsx"]);
    expect(orb.registryDependencies).toEqual([`${baseUrl}/r/lib.json`]);
  });
});

describe("helpers", () => {
  it("extracts static, type-only, re-export and dynamic imports", () => {
    expect(
      extractImports(`
        import a from "a";
        import type { B } from "b";
        export { c } from "c";
        const d = await import("d");
        import "e";
        // import nope from "commented-out";
      `).sort(),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("parses css var blocks", () => {
    const vars = parseCssVars(`
      /* comment */
      @theme inline { --color-x: var(--x); }
      :root { --x: red; }
      .dark { --x: blue; }
    `);
    expect(vars).toEqual({
      theme: { "color-x": "var(--x)" },
      light: { x: "red" },
      dark: { x: "blue" },
    });
  });
});
