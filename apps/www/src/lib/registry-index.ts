import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

export interface IndexedFile {
  path: string;
  target: string;
  type: string;
}

export interface IndexedItem {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: IndexedFile[];
  categories?: string[];
}

/** Base URL that registry dependency links and install commands point at. */
export const REGISTRY_URL = (process.env.REGISTRY_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/** The generated index (`pnpm registry:build`). Read at build/request time on the server. */
export function getRegistryIndex(): { name: string; items: IndexedItem[] } {
  const file = path.join(process.cwd(), "public/r/registry.json");
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error("public/r/registry.json is missing. Run `pnpm registry:build` first.");
  }
}

export function installCommand(name: string): string {
  return `npx shadcn@latest add ${REGISTRY_URL}/r/${name}.json`;
}
