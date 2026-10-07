import type { Metadata } from "next";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "Runtime lab",
  description: "Exercise the Agentica runtime: frame loop, gating, audio signals and shaders.",
};

export default function LabPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-semibold text-2xl tracking-tight">Runtime lab</h1>
      <p className="mt-2 mb-8 max-w-2xl text-sm opacity-70">
        Internal test bench for the foundation. The probes below are reference implementations of
        the component contract, not library components.
      </p>
      <Lab />
    </main>
  );
}
