"use client";

import { type RefObject, useEffect, useRef } from "react";
import { frameLoop } from "@/lib/agentica/core/frame-loop";

/**
 * Polls the shared loop instead of subscribing to it, so it never keeps the
 * loop alive itself. Watch "subscribers" drop to 0 when everything is paused
 * or scrolled away.
 */
export function LoopStats() {
  const fpsRef = useRef<HTMLSpanElement>(null);
  const subsRef = useRef<HTMLSpanElement>(null);
  const runningRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let lastFrame = frameLoop.frameCount;
    let lastTime = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const fps = ((frameLoop.frameCount - lastFrame) * 1000) / (now - lastTime);
      lastFrame = frameLoop.frameCount;
      lastTime = now;
      // Direct DOM writes: diagnostics must not cause React renders either.
      if (fpsRef.current) fpsRef.current.textContent = fps.toFixed(0);
      if (subsRef.current) subsRef.current.textContent = String(frameLoop.size);
      if (runningRef.current)
        runningRef.current.textContent = frameLoop.running ? "running" : "stopped";
    }, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <dl className="grid grid-cols-3 gap-3 font-mono text-xs">
      <Stat label="loop fps" valueRef={fpsRef} />
      <Stat label="subscribers" valueRef={subsRef} />
      <Stat label="loop" valueRef={runningRef} />
    </dl>
  );
}

function Stat({ label, valueRef }: { label: string; valueRef: RefObject<HTMLSpanElement | null> }) {
  return (
    <div className="rounded-lg border border-agentica-muted px-3 py-2">
      <dt className="opacity-50">{label}</dt>
      <dd>
        <span ref={valueRef}>–</span>
      </dd>
    </div>
  );
}
