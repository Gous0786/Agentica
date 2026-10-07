/**
 * The shared vocabulary for conversational agent UIs. Every state-aware visual
 * accepts these, so one `state` value can drive an orb, a waveform and a
 * background in sync. Map your SDK's status to these values with a small adapter.
 */
export const AGENT_STATES = [
  "idle",
  "connecting",
  "listening",
  "thinking",
  "speaking",
  "error",
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

export function isAgentState(value: unknown): value is AgentState {
  return typeof value === "string" && (AGENT_STATES as readonly string[]).includes(value);
}

/** The theme token for each state's color. */
export const AGENT_STATE_COLOR_VARS = Object.fromEntries(
  AGENT_STATES.map((state) => [state, `--agentica-${state}`]),
) as Record<AgentState, `--agentica-${AgentState}`>;

/**
 * One-hot weights over `AGENT_STATES`. Tween these (with `useStateParams`) and
 * blend per-state colors with `blendColors` for smooth, theme-live cross-fades.
 */
export function stateWeights(state: AgentState): number[] {
  return AGENT_STATES.map((s) => (s === state ? 1 : 0));
}

export interface AgentStateProps {
  /** Which agent state to visualise. Default `"idle"`. */
  state?: AgentState;
}
