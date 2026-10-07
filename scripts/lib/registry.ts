/**
 * Registry compiler. The source tree is the single source of truth; this turns
 * it into shadcn-compatible registry JSON and fails loudly on anything that
 * would ship a broken install.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";
import type {
  ComponentMeta,
  RegistryItemConfig,
  RegistryItemType,
} from "../../registry/registry.config.ts";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".css"];
const PEER_PACKAGES = new Set(["react", "react-dom"]);
/** Install-path alias prefix → source directory (relative to the registry root). */
const ALIASES: [alias: string, dir: string][] = [
  ["@/lib/agentica/", "lib/agentica/"],
  ["@/components/agentica/", "ui/"],
];
/** Frame-driven hooks. A component using any of them must also gate itself with useVisualRuntime. */
const ANIMATION_HOOKS = [
  "@/lib/agentica/hooks/use-frame",
  "@/lib/agentica/webgl/use-shader",
  "@/lib/agentica/canvas/use-canvas-2d",
];
const RUNTIME_HOOK = "@/lib/agentica/hooks/use-visual-runtime";

export interface BuildOptions {
  /** Absolute path of the `registry/` directory. */
  root: string;
  /** Prefix for registry-dependency URLs, e.g. https://agentica.dev */
  baseUrl: string;
  foundation: RegistryItemConfig[];
  registryName: string;
  homepage: string;
}

export interface RegistryFile {
  path: string;
  type: RegistryItemType;
  target: string;
  content: string;
}

export interface RegistryItem {
  $schema: string;
  name: string;
  type: RegistryItemType;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
  cssVars?: CssVars;
  categories?: string[];
}

export interface CssVars {
  theme?: Record<string, string>;
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface BuildResult {
  items: RegistryItem[];
  index: object;
}

export class RegistryBuildError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Registry build failed:\n  - ${problems.join("\n  - ")}`);
    this.problems = problems;
  }
}

export async function buildRegistry(options: BuildOptions): Promise<BuildResult> {
  const { root, baseUrl } = options;
  const problems: string[] = [];
  const configs = [...options.foundation, ...(await discoverComponents(root, problems))];
  const versions = readVersions(root);

  // 1. Expand file globs and make sure every source file has exactly one owner.
  const owner = new Map<string, string>();
  const filesByItem = new Map<string, string[]>();
  for (const config of configs) {
    const files = (config.files ?? []).flatMap((entry) => expand(root, entry, problems));
    filesByItem.set(config.name, files);
    for (const file of files) {
      const existing = owner.get(file);
      if (existing) problems.push(`${file} belongs to both "${existing}" and "${config.name}"`);
      owner.set(file, config.name);
    }
  }
  for (const file of listFiles(root, "lib")) {
    if (!owner.has(file)) problems.push(`${file} is not part of any registry item`);
  }

  // 2. Compile each item, deriving dependencies from imports.
  const items: RegistryItem[] = configs.map((config) => {
    const npm = new Set<string>();
    const registryDeps = new Set(config.registryDependencies ?? []);
    const files: RegistryFile[] = [];

    for (const file of filesByItem.get(config.name) ?? []) {
      const content = readFileSync(path.join(root, file), "utf8").replace(/\r\n?/g, "\n");
      const imports = file.endsWith(".css") ? [] : extractImports(content);

      for (const specifier of imports) {
        const local = resolveAlias(root, specifier);
        if (local === null) {
          // Not an alias import.
          if (specifier.startsWith(".")) {
            problems.push(
              `${file}: relative import "${specifier}". Use an @/ alias so files can move.`,
            );
          } else if (specifier.startsWith("@/")) {
            problems.push(`${file}: "${specifier}" is outside the registry aliases.`);
          } else {
            const pkg = packageName(specifier);
            if (PEER_PACKAGES.has(pkg) || isBuiltin(pkg)) continue;
            const version = versions[pkg];
            if (!version)
              problems.push(`${file}: imports "${pkg}", missing from registry/package.json`);
            else npm.add(`${pkg}@${version}`);
          }
          continue;
        }
        if (local === undefined) {
          problems.push(`${file}: cannot resolve "${specifier}"`);
          continue;
        }
        const dependency = owner.get(local);
        if (!dependency) problems.push(`${file}: imports ${local}, which no item publishes`);
        else if (dependency !== config.name) registryDeps.add(dependency);
      }

      if (file.startsWith("ui/")) checkComponentContract(file, content, imports, problems);

      files.push({
        path: `registry/${file}`,
        type: fileType(file, config.type),
        target: targetFor(file),
        content,
      });
    }

    const item: RegistryItem = {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      name: config.name,
      type: config.type,
      title: config.title,
      description: config.description,
      files,
    };
    if (npm.size) item.dependencies = [...npm].sort();
    if (registryDeps.size) {
      item.registryDependencies = [...registryDeps].sort().map((dep) => {
        if (dep.includes("/") || dep.includes(":")) return dep; // already a URL or namespaced
        if (!configs.some((c) => c.name === dep))
          problems.push(`${config.name}: unknown registry dependency "${dep}"`);
        return `${baseUrl}/r/${dep}.json`;
      });
    }
    if (config.cssVars)
      item.cssVars = parseCssVars(readFileSync(path.join(root, config.cssVars), "utf8"));
    if (config.categories?.length) item.categories = config.categories;
    return item;
  });

  if (problems.length) throw new RegistryBuildError(problems);

  const index = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: options.registryName,
    homepage: options.homepage,
    items: items.map(({ $schema: _schema, files, ...rest }) => ({
      ...rest,
      files: files.map(({ content: _content, ...file }) => file),
    })),
  };
  return { items, index };
}

/** Find `ui/<name>/meta.json` components. Everything else in the folder ships, except demos and tests. */
async function discoverComponents(root: string, problems: string[]): Promise<RegistryItemConfig[]> {
  const uiDir = path.join(root, "ui");
  if (!existsSync(uiDir)) return [];
  const configs: RegistryItemConfig[] = [];
  for (const name of readdirSync(uiDir).sort()) {
    const dir = path.join(uiDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, "meta.json");
    if (!existsSync(metaPath)) {
      problems.push(`ui/${name}/ has no meta.json`);
      continue;
    }
    if (!/^[a-z][a-z0-9-]*$/.test(name)) problems.push(`ui/${name}: names must be kebab-case`);
    const meta = readMeta(metaPath, `ui/${name}/meta.json`, problems);
    if (!meta) continue;
    if (!existsSync(path.join(dir, `${name}.tsx`)))
      problems.push(`ui/${name}/ needs an entry file ${name}.tsx`);
    configs.push({
      name,
      type: meta.type ?? "registry:ui",
      title: meta.title,
      description: meta.description,
      categories: meta.categories,
      registryDependencies: meta.registryDependencies,
      files: listFiles(root, `ui/${name}`).filter((f) => !isDevOnly(f)),
    });
  }
  return configs;
}

function readMeta(file: string, label: string, problems: string[]): ComponentMeta | null {
  let meta: Partial<ComponentMeta>;
  try {
    meta = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    problems.push(`${label}: invalid JSON (${(error as Error).message})`);
    return null;
  }
  if (typeof meta.title !== "string" || typeof meta.description !== "string") {
    problems.push(`${label}: needs string "title" and "description"`);
    return null;
  }
  return meta as ComponentMeta;
}

function isDevOnly(file: string): boolean {
  const base = path.posix.basename(file);
  return (
    base === "meta.json" || /(^|\.)demo\.tsx?$/.test(base) || /\.(test|spec)\.tsx?$/.test(base)
  );
}

function checkComponentContract(
  file: string,
  content: string,
  imports: string[],
  problems: string[],
) {
  if (isDevOnly(file) || !file.endsWith(".tsx")) return;
  if (!/^\s*["']use client["']/.test(content))
    problems.push(`${file}: components must start with "use client"`);
  if (imports.some((i) => ANIMATION_HOOKS.includes(i)) && !imports.includes(RUNTIME_HOOK)) {
    problems.push(`${file}: animates without useVisualRuntime (offscreen/reduced-motion gating)`);
  }
}

export function extractImports(source: string): string[] {
  const info = ts.preProcessFile(source, true, true);
  return [...new Set(info.importedFiles.map((f) => f.fileName))];
}

/** `null` = not an alias import; `undefined` = alias that doesn't resolve; else the registry-relative file. */
function resolveAlias(root: string, specifier: string): string | null | undefined {
  for (const [alias, dir] of ALIASES) {
    if (!specifier.startsWith(alias)) continue;
    const base = dir + specifier.slice(alias.length);
    for (const candidate of [
      base,
      ...SOURCE_EXTENSIONS.map((e) => base + e),
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ]) {
      const full = path.join(root, candidate);
      if (existsSync(full) && statSync(full).isFile()) return candidate;
    }
    return undefined;
  }
  return null;
}

function targetFor(file: string): string {
  // Source paths mirror install paths so alias imports stay valid after install.
  if (file.startsWith("ui/")) return `components/agentica/${file.slice(3)}`;
  return file;
}

function fileType(file: string, itemType: RegistryItemType): RegistryItemType {
  if (file.startsWith("ui/"))
    return itemType === "registry:block" ? "registry:component" : itemType;
  return "registry:lib";
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!;
}

function isBuiltin(pkg: string): boolean {
  return pkg.startsWith("node:") || builtinModules.includes(pkg);
}

function readVersions(root: string): Record<string, string> {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  return { ...pkg.dependencies };
}

function expand(root: string, entry: string, problems: string[]): string[] {
  const full = path.join(root, entry);
  if (!existsSync(full)) {
    problems.push(`${entry} does not exist`);
    return [];
  }
  return statSync(full).isDirectory() ? listFiles(root, entry) : [toPosix(entry)];
}

function listFiles(root: string, dir: string): string[] {
  const full = path.join(root, dir);
  if (!existsSync(full)) return [];
  const out: string[] = [];
  for (const name of readdirSync(full).sort()) {
    const rel = toPosix(path.join(dir, name));
    if (statSync(path.join(root, rel)).isDirectory()) out.push(...listFiles(root, rel));
    else if (SOURCE_EXTENSIONS.includes(path.extname(name))) out.push(rel);
  }
  return out;
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Parse `@theme inline {}`, `:root {}` and `.dark {}` blocks of simple declarations. */
export function parseCssVars(css: string): CssVars {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = (selector: RegExp) => {
    const match = selector.exec(clean);
    if (!match) return undefined;
    const vars: Record<string, string> = {};
    for (const decl of match[1]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g))
      vars[decl[1]!] = decl[2]!.trim();
    return vars;
  };
  const result: CssVars = {};
  const theme = block(/@theme\s+inline\s*\{([^}]*)\}/);
  const light = block(/:root\s*\{([^}]*)\}/);
  const dark = block(/\.dark\s*\{([^}]*)\}/);
  if (theme) result.theme = theme;
  if (light) result.light = light;
  if (dark) result.dark = dark;
  return result;
}
