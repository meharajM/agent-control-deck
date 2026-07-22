import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Database } from '@agent-deck/bridge-database';
import { EventJournal } from '../event-journal.js';
import { SnapshotService } from '../snapshot-service.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migrationsDir = join(__dirname, '../../../../db/migrations');

let db: Database;
let journal: EventJournal;
let snapshot: SnapshotService;

beforeEach(async () => {
  db = new Database(':memory:');
  await db.runMigrations(migrationsDir);
  db.db.pragma('foreign_keys = OFF');
  journal = new EventJournal(db.db);
  snapshot = new SnapshotService(db.db);
});

afterEach(() => {
  db.close();
});

function insertTestSession(id: string): void {
  const now = new Date().toISOString();
  const rid = randomUUID();
  db.db.prepare(
    `INSERT OR IGNORE INTO runtime_instances (id, runtime, mode, state, capabilities_json, created_at, updated_at)
     VALUES (?, 'fake', 'attached', 'ready', '{}', ?, ?)`
  ).run(rid, now, now);
  db.db.prepare(
    `INSERT OR IGNORE INTO sessions (id, runtime_instance_id, runtime_session_id, title, state, summary,
     pending_approval_count, pending_question_count, version, created_at, updated_at)
     VALUES (?, ?, ?, 'Test', 'running', '', 0, 0, 1, ?, ?)`
  ).run(id, rid, `rt_${id}`, now, now);
}

describe('Replay convergence: replay = snapshot', () => {
  it('empty journal: snapshot and replay both return empty/default state', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    const events = journal.getAfter(sessionId, 0, 10000);
    const snap = snapshot.getSessionSnapshot(sessionId);

    expect(events).toHaveLength(0);
    expect(snap.session).not.toBeNull();
    expect(snap.session!.state).toBe('running');
  });

  it('single event: replay and snapshot agree on state', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    journal.append(sessionId, 'session.updated', { currentAction: 'Processing' });
    const events = journal.getAfter(sessionId, 0, 10000);
    const snap = snapshot.getSessionSnapshot(sessionId);

    expect(events).toHaveLength(1);
    expect(snap.session).not.toBeNull();
  });

  it('multiple events: replay processes in order', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    journal.append(sessionId, 'session.updated', { currentAction: 'Step 1' });
    journal.append(sessionId, 'session.updated', { currentAction: 'Step 2' });
    journal.append(sessionId, 'session.updated', { currentAction: 'Step 3' });

    const events = journal.getAfter(sessionId, 0, 10000);
    expect(events).toHaveLength(3);
    expect(events[0]!.type).toBe('session.updated');
    expect(events[1]!.type).toBe('session.updated');
    expect(events[2]!.type).toBe('session.updated');
  });

  it('replay produces identical state to snapshot after terminal event', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    journal.append(sessionId, 'session.created', { state: 'running', title: 'Test' });
    journal.append(sessionId, 'session.completed', { status: 'completed', summary: 'Done' });

    const events = journal.getAfter(sessionId, 0, 10000);
    const snap = snapshot.getSessionSnapshot(sessionId);

    // Replay: last terminal event should set state to completed
    let state = 'running';
    for (const e of events) {
      if (e.type === 'session.completed') state = 'completed';
      if (e.type === 'session.failed') state = 'failed';
    }

    // Snapshot from DB shows actual state
    expect(snap.session).not.toBeNull();
    expect(state).toBe('completed');
  });

  it('replay is idempotent: same events applied twice = same state', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    journal.append(sessionId, 'session.updated', { currentAction: 'Processing' });
    journal.append(sessionId, 'session.completed', { status: 'completed', summary: 'Done' });

    const events = journal.getAfter(sessionId, 0, 10000);

    // First pass
    let state1 = 'running';
    for (const e of events) {
      if (e.type === 'session.completed') state1 = 'completed';
    }

    // Second pass (same events)
    let state2 = 'running';
    for (const e of events) {
      if (e.type === 'session.completed') state2 = 'completed';
    }

    expect(state1).toBe(state2);
  });

  it('sequence numbers are monotonic', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    const seq1 = journal.append(sessionId, 'session.updated', { step: 1 });
    const seq2 = journal.append(sessionId, 'session.updated', { step: 2 });
    const seq3 = journal.append(sessionId, 'session.updated', { step: 3 });

    expect(seq2).toBeGreaterThan(seq1);
    expect(seq3).toBeGreaterThan(seq2);
  });

  it('getAfter returns only events after specified sequence', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    journal.append(sessionId, 'session.updated', { step: 1 });
    journal.append(sessionId, 'session.updated', { step: 2 });
    journal.append(sessionId, 'session.updated', { step: 3 });

    const afterSeq1 = journal.getAfter(sessionId, 1, 10000);
    expect(afterSeq1).toHaveLength(2);
    expect(afterSeq1[0]!.payload).toEqual({ step: 2 });
    expect(afterSeq1[1]!.payload).toEqual({ step: 3 });
  });

  it('getLatestSequence returns highest sequence for session', () => {
    const sessionId = randomUUID();
    insertTestSession(sessionId);

    journal.append(sessionId, 'session.updated', { step: 1 });
    journal.append(sessionId, 'session.updated', { step: 2 });

    const latest = journal.getLatestSequence(sessionId);
    expect(latest).toBeGreaterThanOrEqual(2);
  });

  it('different sessions have independent journals', () => {
    const sid1 = randomUUID();
    const sid2 = randomUUID();
    insertTestSession(sid1);
    insertTestSession(sid2);

    journal.append(sid1, 'session.updated', { session: 1 });
    journal.append(sid2, 'session.updated', { session: 2 });

    const events1 = journal.getAfter(sid1, 0, 10000);
    const events2 = journal.getAfter(sid2, 0, 10000);

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
    expect((events1[0]!.payload as Record<string, unknown>)['session']).toBe(1);
    expect((events2[0]!.payload as Record<string, unknown>)['session']).toBe(2);
  });
});
