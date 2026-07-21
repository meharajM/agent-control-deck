import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdapterManager } from '../adapter-manager.js';
import { asHostId, type UcpEnvelope } from '@agent-deck/protocol';
import type {
  AdapterEvent,
  ProbeResult,
  ReconcileResult,
  RuntimeAdapter,
  StartSessionParams,
} from '@agent-deck/adapter-contract';

type RuntimeInstanceRow = {
  id: string;
  runtime: string;
  version: string | null;
  mode: string;
  state: string;
  capabilities_json: string;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  runtime_instance_id: string;
  runtime_session_id: string;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
};

function createFakeDb() {
  const runtimeInstances = new Map<string, RuntimeInstanceRow>();
  const sessions = new Map<string, SessionRow>();

  return {
    runtimeInstances,
    sessions,
    prepare(sql: string) {
      if (sql.includes('INSERT OR IGNORE INTO runtime_instances')) {
        return {
          run(id: string, runtime: string, mode: string, state: string, capabilitiesJson: string, createdAt: string, updatedAt: string) {
            if (!runtimeInstances.has(id)) {
              runtimeInstances.set(id, {
                id,
                runtime,
                version: null,
                mode,
                state,
                capabilities_json: capabilitiesJson,
                created_at: createdAt,
                updated_at: updatedAt,
              });
            }
            return { changes: 1 };
          },
        };
      }

      if (sql.includes('UPDATE runtime_instances')) {
        return {
          run(params: { id: string; runtime: string; version: string | null; state: string; updatedAt: string }) {
            const row = runtimeInstances.get(params.id);
            if (row) {
              row.runtime = params.runtime;
              row.version = params.version;
              row.state = params.state;
              row.updated_at = params.updatedAt;
            }
            return { changes: row ? 1 : 0 };
          },
        };
      }

      if (sql.includes('INSERT OR IGNORE INTO sessions')) {
        return {
          run(id: string, runtimeInstanceId: string, runtimeSessionId: string, title: string, state: string, createdAt: string, updatedAt: string) {
            if (!sessions.has(id)) {
              sessions.set(id, {
                id,
                runtime_instance_id: runtimeInstanceId,
                runtime_session_id: runtimeSessionId,
                title,
                state,
                created_at: createdAt,
                updated_at: updatedAt,
              });
            }
            return { changes: 1 };
          },
        };
      }

      if (sql.includes('UPDATE sessions')) {
        return {
          run(params: { id: string; runtimeInstanceId: string; runtimeSessionId: string; updatedAt: string }) {
            const row = sessions.get(params.id);
            if (row) {
              row.runtime_instance_id = params.runtimeInstanceId;
              row.runtime_session_id = params.runtimeSessionId;
              row.updated_at = params.updatedAt;
            }
            return { changes: row ? 1 : 0 };
          },
        };
      }

      if (sql.includes('SELECT id, runtime FROM runtime_instances')) {
        return {
          get(id: string) {
            const row = runtimeInstances.get(id);
            return row ? { id: row.id, runtime: row.runtime } : undefined;
          },
        };
      }

      if (sql.includes('SELECT runtime_instance_id, runtime_session_id FROM sessions')) {
        return {
          get(id: string) {
            const row = sessions.get(id);
            return row
              ? {
                  runtime_instance_id: row.runtime_instance_id,
                  runtime_session_id: row.runtime_session_id,
                }
              : undefined;
          },
        };
      }

      if (sql.includes('UPDATE approvals')) {
        return { run: () => ({ changes: 1 }) };
      }

      if (sql.includes('UPDATE questions')) {
        return { run: () => ({ changes: 1 }) };
      }

      throw new Error(`Unhandled SQL in test fake DB: ${sql}`);
    },
  };
}

class TestAdapter extends EventEmitter implements RuntimeAdapter {
  readonly adapterVersion = 'test';
  readonly runtimeType: 'fake' | 'codex' | 'opencode' | 'claude';

  constructor(runtimeType: 'fake' | 'codex' | 'opencode' | 'claude') {
    super();
    this.runtimeType = runtimeType;
  }

  async probe(): Promise<ProbeResult> {
    return { available: true, version: '1.2.3' };
  }

  async startSession(_params: StartSessionParams): Promise<string> {
    return 'session-1';
  }

  async sendInstruction(): Promise<void> {}

  async cancelSession(): Promise<void> {}

  async resolveApproval(): Promise<void> {}

  async answerQuestion(): Promise<void> {}

  async reconcile(): Promise<ReconcileResult> {
    return { sessionExists: true, state: 'running' };
  }

  async dispose(): Promise<void> {
    this.removeAllListeners();
  }
}

describe('AdapterManager', () => {
  let db: ReturnType<typeof createFakeDb>;
  let broadcast: ReturnType<typeof vi.fn>;
  let approvals: {
    create: ReturnType<typeof vi.fn>;
    getPending: ReturnType<typeof vi.fn>;
  };
  let questions: {
    create: ReturnType<typeof vi.fn>;
    getPending: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    db = createFakeDb();
    broadcast = vi.fn();
    approvals = {
      create: vi.fn(),
      getPending: vi.fn(() => []),
    };
    questions = {
      create: vi.fn(),
      getPending: vi.fn(() => []),
    };
  });

  function createManager() {
    return new AdapterManager({
      db: db as any,
      journal: {
        append: vi.fn(() => 1),
      } as any,
      approvals: approvals as any,
      questions: questions as any,
      broadcast,
      hostId: asHostId('test-host'),
    });
  }

  it('registerAdapter calls probe()', async () => {
    const manager = createManager();
    const adapter = new TestAdapter('fake');
    const probeSpy = vi.spyOn(adapter, 'probe');

    await manager.registerAdapter('fake', adapter);

    expect(probeSpy).toHaveBeenCalled();
  });

  it('emitting session_event journals and broadcasts the event', async () => {
    const manager = createManager();
    const adapter = new TestAdapter('fake');
    await manager.registerAdapter('fake', adapter);

    const event: AdapterEvent = {
      type: 'session.started',
      sessionId: 'session-1',
      payload: { status: 'running' },
      timestamp: new Date().toISOString(),
    };
    adapter.emit('session_event', event);

    expect(broadcast).toHaveBeenCalledTimes(1);
    const envelope = broadcast.mock.calls[0]?.[0] as UcpEnvelope;
    expect(envelope.type).toBe('session.started');
    expect(envelope.sessionId).toBe('session-1');
  });

  it('approval.requested creates an approval record', async () => {
    const manager = createManager();
    const adapter = new TestAdapter('fake');
    await manager.registerAdapter('fake', adapter);

    adapter.emit('session_event', {
      type: 'approval.requested',
      sessionId: 'session-2',
      payload: {
        approvalId: 'apr-1',
        category: 'file_write',
        risk: 'low',
        reversible: 'yes',
        title: 'Write file',
        summary: 'Create a file',
        decisions: ['approve'],
      },
      timestamp: new Date().toISOString(),
    } satisfies AdapterEvent);

    expect(approvals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-2',
        runtimeApprovalId: 'apr-1',
        category: 'file_write',
      }),
    );
  });

  it('selects and resolves sessions through the registered adapter', async () => {
    const manager = createManager();
    const adapter = new TestAdapter('opencode');
    await manager.registerAdapter('opencode', adapter);
    manager.recordSessionStart('session-123');

    expect(manager.getSelectedAdapter()).toBe(adapter);
    expect(manager.getAdapterForSession('session-123')).toBe(adapter);
  });

  it('persists the adapter runtime type for runtime and session rows', async () => {
    const manager = createManager();
    const adapter = new TestAdapter('opencode');
    await manager.registerAdapter('opencode', adapter);
    manager.recordSessionStart('session-123');

    const runtimeStatement = db.prepare('SELECT id, runtime FROM runtime_instances WHERE id = ?') as {
      get: (id: string) =>
        | { id: string; runtime: string }
        | undefined;
    };
    const sessionStatement = db.prepare(
      'SELECT runtime_instance_id, runtime_session_id FROM sessions WHERE id = ?',
    ) as {
      get: (id: string) =>
        | { runtime_instance_id: string; runtime_session_id: string }
        | undefined;
    };
    const runtimeRow = runtimeStatement.get('runtime:opencode') as
      | { id: string; runtime: string }
      | undefined;
    const sessionRow = sessionStatement.get('session-123') as
      | { runtime_instance_id: string; runtime_session_id: string }
      | undefined;

    expect(runtimeRow).toEqual({ id: 'runtime:opencode', runtime: 'opencode' });
    expect(sessionRow).toEqual({
      runtime_instance_id: 'runtime:opencode',
      runtime_session_id: 'session-123',
    });
  });
});
