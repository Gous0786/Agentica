"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AGENT_STATES, type AgentState } from "@/lib/agentica/agent/states";
import { getMicrophone, resumeAudioContext } from "@/lib/agentica/audio/context";
import { SyntheticSignal } from "@/lib/agentica/audio/synthetic-signal";
import { AgenticaProvider, type ReducedMotionSetting } from "@/lib/agentica/core/provider";
import { cn } from "@/lib/agentica/core/utils";
import { LoopStats } from "./loop-stats";
import { ShaderProbe } from "./shader-probe";
import { SignalScope } from "./signal-scope";

type Source = "synthetic" | "mic" | "none";

export function Lab() {
  const [state, setState] = useState<AgentState>("speaking");
  const [source, setSource] = useState<Source>("synthetic");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<ReducedMotionSetting>("user");
  const [maxFps, setMaxFps] = useState(0);
  const [maxDpr, setMaxDpr] = useState(2);
  const [synthetic] = useState(() => new SyntheticSignal({ seed: 7 }));

  // The synthetic voice "talks" only while the agent is speaking.
  useEffect(() => {
    synthetic.speaking = state === "speaking";
  }, [synthetic, state]);

  // Release the microphone when switching away or unmounting.
  useEffect(() => {
    if (!stream) return;
    return () => {
      for (const track of stream.getTracks()) track.stop();
    };
  }, [stream]);

  const chooseSource = async (next: Source) => {
    setSource(next);
    setMicError(null);
    if (next !== "mic") {
      setStream(null);
      return;
    }
    try {
      // Called from the click: satisfies browser gesture requirements.
      await resumeAudioContext();
      setStream(await getMicrophone());
    } catch (error) {
      setMicError((error as Error).message);
      setSource("none");
    }
  };

  const audio = source === "synthetic" ? synthetic : source === "mic" ? stream : null;

  return (
    <AgenticaProvider paused={paused} reducedMotion={reducedMotion} maxFps={maxFps} maxDpr={maxDpr}>
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-6 text-sm">
          <Group label="Agent state">
            {AGENT_STATES.map((s) => (
              <Chip key={s} active={state === s} onClick={() => setState(s)}>
                {s}
              </Chip>
            ))}
          </Group>
          <Group label="Audio source">
            {(["synthetic", "mic", "none"] as const).map((s) => (
              <Chip key={s} active={source === s} onClick={() => chooseSource(s)}>
                {s}
              </Chip>
            ))}
            {micError && <p className="w-full text-agentica-error text-xs">{micError}</p>}
          </Group>
          <Group label="Playback">
            <Chip active={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? "paused" : "pause all"}
            </Chip>
          </Group>
          <Group label="Reduced motion">
            {(["user", "always", "never"] as const).map((v) => (
              <Chip key={v} active={reducedMotion === v} onClick={() => setReducedMotion(v)}>
                {v}
              </Chip>
            ))}
          </Group>
          <Group label="Max FPS">
            {[0, 60, 30, 15].map((v) => (
              <Chip key={v} active={maxFps === v} onClick={() => setMaxFps(v)}>
                {v === 0 ? "display" : v}
              </Chip>
            ))}
          </Group>
          <Group label="Max DPR">
            {[1, 1.5, 2].map((v) => (
              <Chip key={v} active={maxDpr === v} onClick={() => setMaxDpr(v)}>
                {v}×
              </Chip>
            ))}
          </Group>
          <LoopStats />
        </aside>

        <section className="space-y-6">
          <Panel title="WebGL probe" note="useShader · useStateParams · useColors · AudioSignal">
            <ShaderProbe state={state} audio={audio} className="aspect-video w-full" />
          </Panel>
          <Panel title="Canvas 2D probe" note="useCanvas2D · computeBands · waveform">
            <SignalScope state={state} audio={audio} className="h-44 w-full" />
          </Panel>
          <Panel
            title="Offscreen gating"
            note="Scroll these out of view and watch the subscriber count drop."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {AGENT_STATES.map((s) => (
                <ShaderProbe key={s} state={s} audio={audio} className="aspect-square" />
              ))}
            </div>
            <div className="h-[120vh]" aria-hidden />
          </Panel>
        </section>
      </div>
    </AgenticaProvider>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs uppercase tracking-wide opacity-50">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2.5 py-1 transition-colors",
        active
          ? "border-agentica-primary bg-agentica-primary text-agentica-background"
          : "border-agentica-muted hover:bg-agentica-muted",
      )}
    >
      {children}
    </button>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-agentica-muted p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        <p className="font-mono text-xs opacity-50">{note}</p>
      </div>
      {children}
    </div>
  );
}
