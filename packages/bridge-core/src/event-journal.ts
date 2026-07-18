import type BetterSqlite3 from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

interface JournalRow {
  sequence: number;
  event_id: string;
  session_id: string | null;
  type: string;
  payload_json: string;
  created_at: string;
}

export interface JournalEntry {
  sequence: number;
  eventId: string;
  sessionId: string | null;
  type: string;
  payload: unknown;
  createdAt: string;
}

export class EventJournal {
  private readonly insert: BetterSqlite3.Statement;
  private readonly selectAfter: BetterSqlite3.Statement;
  private readonly selectLatest: BetterSqlite3.Statement;

  constructor(private readonly db: BetterSqlite3.Database) {
    this.insert = db.prepare(
      `INSERT OR IGNORE INTO event_journal (event_id, session_id, type, payload_json, created_at)
       VALUES (@eventId, @sessionId, @type, @payloadJson, @createdAt)`
    );

    this.selectAfter = db.prepare(
      `SELECT sequence, event_id, session_id, type, payload_json, created_at
       FROM event_journal
       WHERE session_id = @sessionId AND sequence > @afterSequence
       ORDER BY sequence ASC
       LIMIT @limit`
    );

    this.selectLatest = db.prepare(
      `SELECT COALESCE(MAX(sequence), 0) AS seq
       FROM event_journal
       WHERE session_id = @sessionId`
    );
  }

  /**
   * Appends an event to the journal. Returns the assigned sequence number.
   * Uses INSERT OR IGNORE + event_id for safe retry idempotency.
   * // ponytail: event_id generated here; callers may supply their own for deterministic replay
   */
  append(sessionId: string | null, type: string, payload: unknown): number {
    const eventId = randomUUID();
    const now = new Date().toISOString();
    this.insert.run({
      eventId,
      sessionId: sessionId ?? null,
      type,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
    });
    const row = this.db
      .prepare<{ eventId: string }, { sequence: number }>(
        `SELECT sequence FROM event_journal WHERE event_id = @eventId`
      )
      .get({ eventId });
    return row?.sequence ?? 0;
  }

  getAfter(
    sessionId: string,
    afterSequence: number,
    limit = 200
  ): JournalEntry[] {
    const rows = this.selectAfter.all({
      sessionId,
      afterSequence,
      limit,
    }) as JournalRow[];
    return rows.map(toEntry);
  }

  getLatestSequence(sessionId: string): number {
    const row = this.db
      .prepare<{ sessionId: string }, { seq: number }>(
        `SELECT COALESCE(MAX(sequence), 0) AS seq FROM event_journal WHERE session_id = @sessionId`
      )
      .get({ sessionId });
    return row?.seq ?? 0;
  }
}

function toEntry(r: JournalRow): JournalEntry {
  return {
    sequence: r.sequence,
    eventId: r.event_id,
    sessionId: r.session_id,
    type: r.type,
    payload: JSON.parse(r.payload_json) as unknown,
    createdAt: r.created_at,
  };
}
