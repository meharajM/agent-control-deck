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

export type FaultType = 'crash' | 'delay' | 'duplicate' | 'reorder' | 'drop';

interface FaultConfig {
  crash: boolean;
  delayMs: number;
  duplicateCount: number;
  reorderWindow: number;
  dropCount: number;
}

const DEFAULT_FAULTS: FaultConfig = {
  crash: false,
  delayMs: 0,
  duplicateCount: 0,
  reorderWindow: 0,
  dropCount: 0,
};

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
  private faults: FaultConfig = { ...DEFAULT_FAULTS };
  private approvalRace = false;
  private networkPartition = false;
  private slowResponse = false;
  private emitCounter = 0;
  private reorderBuffer: AdapterEvent[] = [];

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
        this.applyFaultDelay().then(() => this.emitWithFaults(event));
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
    void text;
    if (this.networkPartition) return;
    const event: AdapterEvent = {
      type: 'instruction.accepted',
      sessionId,
      payload: { text },
      timestamp: new Date().toISOString(),
    };
    await this.applyFaultDelay();
    setImmediate(() => this.emitWithFaults(event));
  }

  async cancelSession(sessionId: string, _idempotencyKey: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.state = 'cancelled';
      for (const t of s.timers) clearTimeout(t);
    }
    if (this.networkPartition) return;
    const event: AdapterEvent = {
      type: 'session.cancelled',
      sessionId,
      payload: {},
      timestamp: new Date().toISOString(),
    };
    setImmediate(() => this.emitWithFaults(event));
  }

  async resolveApproval(
    sessionId: string,
    approvalId: string,
    decision: string,
    _idempotencyKey: string
  ): Promise<void> {
    if (this.networkPartition) return;
    const event: AdapterEvent = {
      type: 'approval.resolved',
      sessionId,
      payload: { approvalId, decision },
      timestamp: new Date().toISOString(),
    };
    await this.applyFaultDelay();
    setImmediate(() => this.emitWithFaults(event));
  }

  async answerQuestion(
    sessionId: string,
    questionId: string,
    answer: unknown,
    _idempotencyKey: string
  ): Promise<void> {
    if (this.networkPartition) return;
    const event: AdapterEvent = {
      type: 'question.answered',
      sessionId,
      payload: { questionId, answer },
      timestamp: new Date().toISOString(),
    };
    setImmediate(() => this.emitWithFaults(event));
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
    this.faults = { ...DEFAULT_FAULTS };
    this.approvalRace = false;
    this.networkPartition = false;
    this.slowResponse = false;
    this.reorderBuffer = [];
    this.removeAllListeners();
  }

  injectFault(type: FaultType): void {
    switch (type) {
      case 'crash':
        this.faults.crash = true;
        break;
      case 'delay':
        this.faults.delayMs = 500 + Math.floor(this.seededRandom() * 1500);
        break;
      case 'duplicate':
        this.faults.duplicateCount = 2;
        break;
      case 'reorder':
        this.faults.reorderWindow = 3;
        break;
      case 'drop':
        this.faults.dropCount = 1;
        break;
    }
  }

  clearFaults(): void {
    this.faults = { ...DEFAULT_FAULTS };
    this.reorderBuffer = [];
  }

  setApprovalRace(enabled: boolean): void {
    this.approvalRace = enabled;
  }

  setNetworkPartition(enabled: boolean): void {
    this.networkPartition = enabled;
  }

  setSlowResponse(enabled: boolean): void {
    this.slowResponse = enabled;
  }

  private seededRandom(): number {
    this.emitCounter = (this.emitCounter * 1664525 + 1013904223) % 4294967296;
    return this.emitCounter / 4294967296;
  }

  private applyFaultDelay(): Promise<void> {
    if (this.faults.delayMs > 0) {
      return new Promise((resolve) => setTimeout(resolve, this.faults.delayMs));
    }
    if (this.slowResponse) {
      return new Promise((resolve) => setTimeout(resolve, 500 + Math.floor(this.seededRandom() * 1500)));
    }
    return Promise.resolve();
  }

  private emitWithFaults(event: AdapterEvent): void {
    if (this.faults.crash) {
      this.emit('adapter_crash', { sessionId: event.sessionId });
      return;
    }
    if (this.faults.dropCount > 0) {
      this.faults.dropCount--;
      return;
    }
    if (this.faults.duplicateCount > 0) {
      for (let i = 0; i < this.faults.duplicateCount; i++) {
        this.emit('session_event', { ...event, faultDuplicate: true });
      }
      this.faults.duplicateCount = 0;
    }

    if (this.faults.reorderWindow > 0) {
      this.reorderBuffer.push(event);
      if (this.reorderBuffer.length >= this.faults.reorderWindow) {
        const buffered = [...this.reorderBuffer].reverse();
        this.reorderBuffer = [];
        this.faults.reorderWindow = 0;
        for (const bufferedEvent of buffered) {
          this.emit('session_event', bufferedEvent);
        }
      }
      return;
    }

    this.emit('session_event', event);
  }
}
