import Link from "next/link";
import { getRegistryIndex, installCommand } from "@/lib/registry-index";

const PRINCIPLES = [
  ["One frame loop", "Every visual shares a single requestAnimationFrame that stops when idle."],
  ["Gated by default", "Offscreen, hidden-tab, paused and reduced-motion visuals do no work."],
  [
    "No per-frame renders",
    "Audio, tweens and colors live in refs and typed arrays, never React state.",
  ],
  ["Theme-live", "Shaders read CSS variables, so dark mode and re-theming just work."],
  [
    "Source-agnostic audio",
    "Mic, media element, SDK volume or synthetic: one AudioSignal interface.",
  ],
  ["Copy-paste distribution", "shadcn registry with dependencies derived from real imports."],
] as const;

export default function Home() {
  const { items } = getRegistryIndex();
  const foundation = items.filter((item) => item.name.startsWith("agentica-"));

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-semibold text-4xl tracking-tight">Agentica foundation</h1>
      <p className="mt-3 max-w-2xl text-lg opacity-70">
        The runtime every Agentica visual is built on. Components are thin layers over these
        primitives, so performance, accessibility and theming are solved once.
      </p>
      <p className="mt-6">
        <Link href="/lab" className="underline underline-offset-4">
          Open the runtime lab →
        </Link>
      </p>

      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map(([title, body]) => (
          <div key={title} className="rounded-xl border border-agentica-muted p-5">
            <h2 className="font-medium">{title}</h2>
            <p className="mt-1 text-sm opacity-70">{body}</p>
          </div>
        ))}
      </section>

      <h2 className="mt-16 font-semibold text-2xl tracking-tight">Registry items</h2>
      <ul className="mt-6 space-y-4">
        {foundation.map((item) => (
          <li key={item.name} className="rounded-xl border border-agentica-muted p-5">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h3 className="font-medium">{item.title}</h3>
              <code className="text-xs opacity-60">{item.name}</code>
            </div>
            <p className="mt-1 text-sm opacity-70">{item.description}</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-agentica-muted px-3 py-2 font-mono text-xs">
              {installCommand(item.name)}
            </pre>
            {item.files.length > 0 && (
              <p className="mt-3 font-mono text-xs opacity-50">
                {item.files.map((file) => file.target).join("  ·  ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
