import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  RuntimeAdapter,
  AdapterEvent,
  ProbeResult,
  StartSessionParams,
  ReconcileResult,
} from '@agent-deck/adapter-contract';
import {
  defaultScenario,
  buildAdapterEvent,
  type ScenarioStep,
} from './scenarios/default.js';

interface SessionState {
  id: string;
  state: 'running' | 'completed' | 'cancelled';
  timers: ReturnType<typeof setTimeout>[];
}

/**
 * FakeAdapter implements RuntimeAdapter with in-memory scripted scenarios.
 * Use for integration testing without any real runtime.
 * // ponytail: in-memory only, replace with persistent store if throughput requires
 */
export class FakeAdapter extends EventEmitter implements RuntimeAdapter {
  readonly runtimeType = 'fake' as const;
  readonly adapterVersion = '0.1.0-fake';

  private readonly sessions = new Map<string, SessionState>();
  private readonly scenario: ScenarioStep[];

  constructor(scenario: ScenarioStep[] = defaultScenario) {
    super();
    this.scenario = scenario;
  }

  async probe(): Promise<ProbeResult> {
    return { available: true, version: this.adapterVersion };
  }

  async startSession(params: StartSessionParams): Promise<string> {
    const sessionId = randomUUID();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const state: SessionState = { id: sessionId, state: 'running', timers };
    this.sessions.set(sessionId, state);

    // Schedule scripted events
    let elapsed = 0;
    for (const step of this.scenario) {
      elapsed += step.delayMs;
      const t = setTimeout(() => {
        const s = this.sessions.get(sessionId);
        if (!s || s.state !== 'running') return;
        if (step.type === 'session.completed' || step.type === 'session.failed') {
          s.state = 'completed';
        }
        const event = buildAdapterEvent(sessionId, step);
        this.emit('session_event', event);
      }, elapsed);
      timers.push(t);
    }

    // Suppress unused-param warning — params are intentionally unused in fake
    void params;
    return sessionId;
  }

  async sendInstruction(
    sessionId: string,
    text: string,
    _idempotencyKey: string
  ): Promise<void> {
    // Fake: emit a synthetic ack event
    void text;
    const event: AdapterEvent = {
      type: 'instruction.accepted',
      sessionId,
      payload: { text },
      timestamp: new Date().toISOString(),
    };
    // Emit asynchronously so callers don't depend on sync emission
    setImmediate(() => this.emit('session_event', event));
  }

  async cancelSession(sessionId: string, _idempotencyKey: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.state = 'cancelled';
      for (const t of s.timers) clearTimeout(t);
    }
    const event: AdapterEvent = {
      type: 'session.cancelled',
      sessionId,
      payload: {},
      timestamp: new Date().toISOString(),
    };
    setImmediate(() => this.emit('session_event', event));
  }

  async resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: string,
    _idempotencyKey: string
  ): Promise<void> {
    const event: AdapterEvent = {
      type: 'approval.resolved',
      sessionId,
      payload: { approvalId, decision },
      timestamp: new Date().toISOString(),
    };
    setImmediate(() => this.emit('session_event', event));
  }

  async answerQuestion(
    sessionId: string,
    questionId: string,
    answer: unknown,
    _idempotencyKey: string
  ): Promise<void> {
    const event: AdapterEvent = {
      type: 'question.answered',
      sessionId,
      payload: { questionId, answer },
      timestamp: new Date().toISOString(),
    };
    setImmediate(() => this.emit('session_event', event));
  }

  async reconcile(sessionId: string): Promise<ReconcileResult> {
    const s = this.sessions.get(sessionId);
    if (!s) return { sessionExists: false };
    return { sessionExists: true, state: s.state };
  }

  async dispose(): Promise<void> {
    for (const s of this.sessions.values()) {
      for (const t of s.timers) clearTimeout(t);
    }
    this.sessions.clear();
    this.removeAllListeners();
  }

  override on(event: 'session_event', listener: (e: AdapterEvent) => void): this;
  override on(event: string, listener: (...args: unknown[]) => void): this;
  override on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  override off(event: 'session_event', listener: (e: AdapterEvent) => void): this;
  override off(event: string, listener: (...args: unknown[]) => void): this;
  override off(event: string, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}
