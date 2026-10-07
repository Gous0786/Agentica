# Agentica: agent notes

- Read CONTRIBUTING.md before adding or changing registry code. The component contract there is mandatory.
- `registry/` is what users install. Keep it free of app-specific code. `apps/www` is the docs site.
- Imports inside `registry/` must use `@/lib/agentica/...` or `@/components/agentica/...` (never relative).
- Never call `setState` or allocate inside frame callbacks. Use refs and preallocated typed arrays.
- After registry changes run `pnpm check`. `pnpm build` must also pass for docs changes.
- Next.js 16: read `node_modules/next/dist/docs/` before using unfamiliar Next APIs.
- Scripts in `scripts/` run with Node's built-in TypeScript stripping: erasable syntax only
  (no enums, no parameter properties), and import with explicit `.ts` extensions.
