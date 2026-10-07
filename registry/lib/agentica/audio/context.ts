/**
 * One shared AudioContext for the page. Browsers limit how many can exist, and
 * each starts "suspended" until a user gesture, so we create it lazily and
 * resume it on the first pointer/key interaction.
 */

let context: AudioContext | null = null;
let unlockInstalled = false;

export function getAudioContext(): AudioContext {
  if (!context) {
    context = new AudioContext({ latencyHint: "interactive" });
    installUnlock(context);
  }
  return context;
}

/** Call from a click handler to guarantee audio is running (e.g. before mic start). */
export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state !== "running") await ctx.resume();
}

function installUnlock(ctx: AudioContext) {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const unlock = () => {
    if (ctx.state === "running") return remove();
    ctx.resume().then(remove, () => {});
  };
  const remove = () => {
    for (const e of events) window.removeEventListener(e, unlock, true);
  };
  for (const e of events) window.addEventListener(e, unlock, true);
}

/** Microphone stream tuned for voice UIs. Must be called from a user gesture on iOS. */
export function getMicrophone(constraints: MediaTrackConstraints = {}): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...constraints,
    },
  });
}
