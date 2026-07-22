import type { Scenario } from '../scenario-types.js';

export interface PerformanceConfig {
  sessionCount: number;
  eventsPerMinute: number;
  burstDuration: number;
  reconnectCycles: number;
  memorySampleInterval: number;
}

const DEFAULT_PERF_CONFIG: PerformanceConfig = {
  sessionCount: 100,
  eventsPerMinute: 1000,
  burstDuration: 60,
  reconnectCycles: 1000,
  memorySampleInterval: 5000,
};

/**
 * Performance scenario — burst/endurance testing.
 * Generates rapid events to test throughput and memory stability.
 */
export function buildPerformanceScenario(config: Partial<PerformanceConfig> = {}): Scenario {
  const cfg = { ...DEFAULT_PERF_CONFIG, ...config };
  const eventInterval = Math.max(1, Math.floor((cfg.burstDuration * 1000 * 60) / cfg.eventsPerMinute));

  const steps = [];
  for (let i = 0; i < cfg.eventsPerMinute; i++) {
    steps.push({
      delayMs: eventInterval,
      event: {
        type: 'session.updated',
        sessionId: `ses_perf_${i % cfg.sessionCount}`,
        payload: {
          summary: `Performance event ${i}`,
          currentAction: `Burst step ${i}`,
          version: i + 1,
        },
      },
    });
  }

  return {
    id: 'performance-burst',
    description: `Burst test: ${cfg.eventsPerMinute} events at ${cfg.sessionCount} sessions`,
    steps,
  };
}

/**
 * Reconnect endurance scenario — N reconnect cycles without unbounded memory growth.
 */
export function buildReconnectEnduranceScenario(
  reconnectCycles: number = DEFAULT_PERF_CONFIG.reconnectCycles
): Scenario {
  const steps = [];
  for (let i = 0; i < reconnectCycles; i++) {
    steps.push({
      delayMs: 1,
      event: {
        type: 'session.updated',
        sessionId: `ses_endure_${i % 10}`,
        payload: { summary: `Cycle ${i}`, currentAction: `Reconnect ${i}` },
      },
    });
  }
  return {
    id: 'reconnect-endurance',
    description: `Endurance: ${reconnectCycles} reconnect cycles`,
    steps,
  };
}

export { DEFAULT_PERF_CONFIG };
