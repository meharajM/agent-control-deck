import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '@agent-deck/bridge-database';
import { EventJournal } from '../event-journal.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migrationsDir = join(__dirname, '../../../../db/migrations');

describe('EventJournal', () => {
  let db: Database;
  let journal: EventJournal;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.runMigrations(migrationsDir);
    journal = new EventJournal(db.db);
  });

  afterEach(() => {
    db.close();
  });

  it('appends an event and returns a positive sequence number', () => {
    const seq = journal.append(null, 'session.started', { foo: 1 });
    expect(seq).toBeGreaterThan(0);
  });

  it('getAfter returns events after given sequence', () => {
    // Events with null sessionId won't appear in session-scoped query — use a fake session id
    // We insert directly to avoid FK constraint on session_id
    const fakeSession = 'sess-abc';

    // Bypass FK — disable foreign keys for this test
    db.db.pragma('foreign_keys = OFF');

    const s1 = journal.append(fakeSession, 'type.a', { n: 1 });
    const s2 = journal.append(fakeSession, 'type.b', { n: 2 });
    const s3 = journal.append(fakeSession, 'type.c', { n: 3 });

    const after1 = journal.getAfter(fakeSession, s1);
    expect(after1.map((e) => e.sequence)).toEqual([s2, s3]);

    const after0 = journal.getAfter(fakeSession, 0);
    expect(after0.length).toBe(3);
    expect(after0[0]?.sequence).toBe(s1);
  });

  it('getLatestSequence returns max sequence for session', () => {
    db.db.pragma('foreign_keys = OFF');
    const fakeSession = 'sess-xyz';
    journal.append(fakeSession, 'a', {});
    const s = journal.append(fakeSession, 'b', {});
    expect(journal.getLatestSequence(fakeSession)).toBe(s);
  });

  it('getLatestSequence returns 0 for unknown session', () => {
    expect(journal.getLatestSequence('no-such-session')).toBe(0);
  });

  it('append is idempotent via UNIQUE event_id — different events still get unique sequences', () => {
    db.db.pragma('foreign_keys = OFF');
    const s1 = journal.append('s1', 'x', {});
    const s2 = journal.append('s1', 'x', {});
    expect(s2).toBeGreaterThan(s1);
  });
});
