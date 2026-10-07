# Agentica

Animated, audio-reactive React components for AI interfaces: agent states, voice visualizers,
blobs and backgrounds. Distributed as a [shadcn registry](https://ui.shadcn.com/docs/registry),
so you own the code you install.

This repository currently contains the **foundation** that every component builds on.

## Why a foundation first

Visuals for AI apps run continuously, often several at once, and react to live audio. Writing
each one standalone leads to N animation loops, leaked GPU contexts, battery drain offscreen,
React re-rendering 60 times per second, and colors that ignore the theme. The foundation solves
these once:

| Concern | Solution |
| --- | --- |
| Animation | One shared `requestAnimationFrame` (`frameLoop`) that stops when idle; priorities; per-visual FPS caps |
| Wasted work | `useVisualRuntime` gates on viewport, tab visibility, `paused`, and reduced motion |
| Rendering | `useShader` (dependency-free WebGL2 with context-loss recovery) and `useCanvas2D`, both DPR-capped |
| Audio | `AudioSignal`: mic, media element, Web Audio node, SDK volume (`VolumeSignal`) or `SyntheticSignal`, sampled once per frame and only while needed |
| Agent state | `AgentState` vocabulary and `useStateParams` spring/damp tweening, with zero allocation per frame |
| Theming | `--agentica-*` tokens; `useColors` resolves any CSS color (oklch, color-mix, vars) for shaders and follows theme changes |
| Distribution | Registry JSON compiled from source; dependencies derived from imports; strict-mode compile guaranteed |

## Install (consumers)

```bash
npx shadcn@latest add https://<your-domain>/r/agentica-core.json
```

Components pull in the foundation pieces they need automatically.

## Develop

```bash
pnpm install
pnpm dev          # docs + runtime lab at http://localhost:3000 (see /lab)
pnpm check        # lint, typecheck, test, registry build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout, the component contract, and how to add a
component.
