/**
 * Compile registry/ into installable shadcn registry JSON.
 *
 *   node scripts/build-registry.ts
 *   REGISTRY_URL=https://agentica.dev node scripts/build-registry.ts
 *
 * Outputs (all generated, all gitignored):
 *   apps/www/public/r/<item>.json   one per item, with file contents (what `shadcn add` fetches)
 *   apps/www/public/r/registry.json index without contents (docs, search, future MCP server)
 *   registry.json                   same index at the repo root, for shadcn tooling
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { foundationItems, registry } from "../registry/registry.config.ts";
import { buildRegistry, RegistryBuildError } from "./lib/registry.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "apps/www/public/r");
const baseUrl = (process.env.REGISTRY_URL ?? "http://localhost:3000").replace(/\/$/, "");

try {
  const started = performance.now();
  const { items, index } = await buildRegistry({
    root: path.join(repoRoot, "registry"),
    baseUrl,
    foundation: foundationItems,
    registryName: registry.name,
    homepage: registry.homepage,
  });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const item of items) {
    writeFileSync(path.join(outDir, `${item.name}.json`), `${JSON.stringify(item, null, 2)}\n`);
  }
  const indexJson = `${JSON.stringify(index, null, 2)}\n`;
  writeFileSync(path.join(outDir, "registry.json"), indexJson);
  writeFileSync(path.join(repoRoot, "registry.json"), indexJson);

  const files = items.reduce((n, item) => n + item.files.length, 0);
  const ms = Math.round(performance.now() - started);
  console.log(
    `registry: ${items.length} items, ${files} files → apps/www/public/r (${ms}ms, ${baseUrl})`,
  );
} catch (error) {
  console.error(error instanceof RegistryBuildError ? error.message : error);
  process.exit(1);
}
