# Contributing

## Layout

```
registry/                 Everything users install. The single source of truth.
  lib/agentica/           Foundation runtime (published as agentica-* items)
    core/                 frame loop, env stores, observers, provider, math, types
    hooks/                useFrame, useVisualRuntime, useInView, useReducedMotion, ...
    canvas/               useCanvasSize, useCanvas2D
    webgl/                ShaderRenderer, useShader, uniforms, glsl/ chunks
    color/                parseColor/resolveColor, blendColors, useColors, themeStore
    audio/                AudioSignal + Analyser/Volume/Synthetic signals, bands, useAudioSignal
    agent/                AgentState, ParamTween, useStateParams
  ui/<name>/              One folder per visual component (auto-discovered)
  styles/agentica.css     Theme tokens (also become the agentica-theme item's cssVars)
  registry.config.ts      Foundation item manifest
  package.json            npm versions that consumers receive
scripts/build-registry.ts Compiles registry/ → apps/www/public/r/*.json
apps/www/                 Docs site + runtime lab (imports registry/ source directly)
tests/                    Vitest: runtime logic + registry build validation
```

Source paths mirror install paths: `registry/lib/agentica/x.ts` installs to `lib/agentica/x.ts`,
and `registry/ui/orb/orb.tsx` installs to `components/agentica/orb/orb.tsx`. So the `@/lib/agentica/...`
and `@/components/agentica/...` imports you write are exactly the ones users end up with.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build the registry, then run the docs site at http://localhost:3000 |
| `pnpm registry:build` | Compile the registry JSON (`REGISTRY_URL=...` sets dependency URLs) |
| `pnpm test` | Unit tests |
| `pnpm typecheck` | Registry (strict consumer settings), scripts, and docs site |
| `pnpm lint` / `pnpm lint:fix` | Biome |
| `pnpm check` | Everything CI runs |

## Adding a component

1. Create `registry/ui/<name>/` (kebab-case) containing:
   - `<name>.tsx`: the entry file.
   - `meta.json`: `{ "title": "...", "description": "...", "categories": ["..."] }`.
   - Optionally more source files (they ship), and `<name>.demo.tsx` (docs only, never ships).
2. Run `pnpm registry:build`. Dependencies are **derived from your imports**:
   - `@/lib/agentica/...` or `@/components/agentica/...` imports become registry dependencies.
   - npm imports become `dependencies`, with versions from `registry/package.json`. Add new
     packages there first, or the build fails.
   - Relative imports are rejected. Always use the aliases.

## The component contract

The build enforces the first two rules. Review enforces the rest.

1. **`"use client"`** at the top of every component file.
2. **Gate through `useVisualRuntime`.** Anything that animates (`useFrame`, `useShader`,
   `useCanvas2D`) must take `runtime` from `useVisualRuntime(rootRef, props)`. That one gate
   handles offscreen, hidden tab, `paused`, provider pause and reduced motion.
3. **Extend the shared prop types:** `VisualProps` (className, style, paused, maxFps, maxDpr),
   plus `AudioReactiveProps` (`audio`) and/or `AgentStateProps` (`state`) where relevant.
4. **No React state per frame.** Audio, tweens and scratch values live in refs and typed arrays.
   Write to canvases, uniforms or `element.style`, never `setState`, inside frame callbacks.
5. **No allocation per frame.** Preallocate `Float32Array`s (`useState(() => new Float32Array(n))`)
   and reuse them. Library helpers (`computeBands`, `blendColors`, `ParamTween`) write in place.
6. **Integrate, don't multiply, time.** For a speed that can change, accumulate
   `phase += delta * speed` instead of `time * speed`, which jumps when speed changes.
7. **Theme through tokens.** Default colors are CSS variables (`--agentica-*`) resolved with
   `useColors`. Accept any CSS color or `--var` as a prop override.
8. **Audio via `useAudioSignal(props.audio, { active: runtime.active })`.** Never create
   AudioContexts or analysers in a component.
9. **State changes via `useStateParams(state, PRESETS, { immediate: !runtime.active })`**, with
   presets at module scope. For colors, tween `stateWeights(state)` and `blendColors` per frame.
10. **Always have a fallback.** Render a CSS layer that shows during SSR, before WebGL is ready,
    and when WebGL is unsupported (`useShader` returns `status`).
11. **Reduced motion means a meaningful still frame**, not a blank box. The hooks repaint a
    static frame automatically. Make sure your `staticTime`/presets look right when still.
12. **Clean up everything** (the hooks do this for you; custom resources need it in effect cleanup).
    Never call `WEBGL_lose_context` on unmount, because StrictMode remounts reuse the canvas.

`apps/www/src/app/lab/shader-probe.tsx` and `signal-scope.tsx` are reference implementations
of this contract. Copy their structure.

## Frame priorities

Use `FramePriority`: `input` (signals sample themselves here) → `update` → `render` → `after`.
Audio signals are sampled once per frame no matter how many visuals read them, and only while
some active visual has retained them.

## Foundation changes

Foundation items are listed in `registry/registry.config.ts`. Every file under
`registry/lib/` must belong to exactly one item. The build fails on orphans and duplicates.
Registry code must compile under strict consumer settings (`noUncheckedIndexedAccess`,
`verbatimModuleSyntax`), which `pnpm typecheck` enforces.
