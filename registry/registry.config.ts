/**
 * Registry manifest for the foundation layer. Visual components do NOT go here:
 * each lives in `registry/ui/<name>/` with its own `meta.json` and is discovered
 * automatically (see CONTRIBUTING.md).
 *
 * You never list npm dependencies or registry dependencies by hand. The build
 * derives them from each file's imports. Versions come from registry/package.json.
 */

export type RegistryItemType =
  | "registry:lib"
  | "registry:hook"
  | "registry:ui"
  | "registry:component"
  | "registry:block"
  | "registry:theme";

export interface RegistryItemConfig {
  name: string;
  type: RegistryItemType;
  title: string;
  description: string;
  /** Paths relative to `registry/`. A directory includes every file below it. */
  files?: string[];
  /** Extra registry deps that imports can't reveal (e.g. the theme tokens). */
  registryDependencies?: string[];
  /** CSS file (relative to `registry/`) whose blocks become the item's `cssVars`. */
  cssVars?: string;
  categories?: string[];
}

/** Shape of `registry/ui/<name>/meta.json`. Name and files are inferred from the folder. */
export interface ComponentMeta {
  title: string;
  description: string;
  type?: Extract<RegistryItemType, "registry:ui" | "registry:component" | "registry:block">;
  categories?: string[];
  registryDependencies?: string[];
}

export const registry = {
  name: "agentica",
  homepage: "https://agentica.dev",
} as const;

export const foundationItems: RegistryItemConfig[] = [
  {
    name: "agentica-theme",
    type: "registry:theme",
    title: "Theme tokens",
    description: "Agentica CSS variables: surface colors plus one color per agent state.",
    cssVars: "styles/agentica.css",
  },
  {
    name: "agentica-core",
    type: "registry:lib",
    title: "Core runtime",
    description:
      "Shared frame loop, visibility/reduced-motion gating, shared observers, provider and math.",
    files: ["lib/agentica/core", "lib/agentica/hooks"],
    registryDependencies: ["agentica-theme"],
  },
  {
    name: "agentica-canvas",
    type: "registry:lib",
    title: "Canvas",
    description: "DPR-aware canvas sizing and a 2D canvas hook driven by the frame loop.",
    files: ["lib/agentica/canvas"],
  },
  {
    name: "agentica-webgl",
    type: "registry:lib",
    title: "WebGL",
    description:
      "Dependency-free WebGL2 full-screen shader runner, reflected uniforms and GLSL chunks.",
    files: ["lib/agentica/webgl"],
  },
  {
    name: "agentica-color",
    type: "registry:lib",
    title: "Color",
    description: "Resolve CSS colors and variables to floats for shaders; theme-change aware.",
    files: ["lib/agentica/color"],
  },
  {
    name: "agentica-audio",
    type: "registry:lib",
    title: "Audio",
    description:
      "AudioSignal abstraction: analyser, volume-adapter and synthetic sources, plus band math.",
    files: ["lib/agentica/audio"],
  },
  {
    name: "agentica-agent",
    type: "registry:lib",
    title: "Agent state",
    description: "AgentState vocabulary and allocation-free param tweening between states.",
    files: ["lib/agentica/agent"],
  },
];
