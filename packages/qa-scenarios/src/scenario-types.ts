/**
 * Scenario type definitions for the QA fake scenario engine.
 *
 * Scenarios drive the fake runtime adapter and the bridge integration harness.
 * They are deterministic, time-controlled sequences of UCP-like events.
 */

/** A single timed event step in a scenario. */
export interface ScenarioStep {
  /** Milliseconds after scenario start (or after the previous step's delayMs for relative sequences). */
  delayMs: number;
  /** The event to emit. Special type values: "DISCONNECT", "RECONNECT". */
  event: ScenarioEvent;
}

export interface ScenarioEvent {
  type: string;
  sessionId: string;
  payload: unknown;
}

/** A named, deterministic scenario. */
export interface Scenario {
  id: string;
  description: string;
  steps: ScenarioStep[];
}
