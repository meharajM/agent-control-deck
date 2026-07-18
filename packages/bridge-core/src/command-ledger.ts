import type BetterSqlite3 from 'better-sqlite3';

export type CommandState =
  | 'accepted'
  | 'dispatched'
  | 'confirmed'
  | 'failed'
  | 'expired';

export interface AcceptInput {
  id: string;
  idempotencyKey: string;
  deviceId: string;
  sessionId?: string | null;
  commandType: string;
  payloadHash: string;
}

export class CommandLedger {
  private readonly insertCmd: BetterSqlite3.Statement;
  private readonly checkKey: BetterSqlite3.Statement;
  private readonly updateState: BetterSqlite3.Statement;

  constructor(private readonly db: BetterSqlite3.Database) {
    this.insertCmd = db.prepare(
      `INSERT OR IGNORE INTO commands
         (id, idempotency_key, device_id, session_id, command_type, state, payload_hash, created_at, updated_at)
       VALUES
         (@id, @idempotencyKey, @deviceId, @sessionId, @commandType, 'accepted', @payloadHash, @now, @now)`
    );

    this.checkKey = db.prepare(
      `SELECT id FROM commands WHERE idempotency_key = @idempotencyKey`
    );

    this.updateState = db.prepare(
      `UPDATE commands SET state = @state, updated_at = @now WHERE id = @id`
    );
  }

  /**
   * Accepts a command or detects a duplicate by idempotencyKey.
   * Returns 'accepted' on first insert, 'duplicate' if key already exists.
   */
  accept(cmd: AcceptInput): 'accepted' | 'duplicate' {
    const now = new Date().toISOString();
    const info = this.insertCmd.run({
      id: cmd.id,
      idempotencyKey: cmd.idempotencyKey,
      deviceId: cmd.deviceId,
      sessionId: cmd.sessionId ?? null,
      commandType: cmd.commandType,
      payloadHash: cmd.payloadHash,
      now,
    });
    // INSERT OR IGNORE: changes === 0 means key already existed
    return info.changes > 0 ? 'accepted' : 'duplicate';
  }

  markDispatched(id: string): void {
    this.updateState.run({ state: 'dispatched', now: new Date().toISOString(), id });
  }

  markComplete(id: string, receipt: unknown): void {
    this.db
      .prepare(
        `UPDATE commands
         SET state = 'confirmed', runtime_receipt_json = @receipt, updated_at = @now
         WHERE id = @id`
      )
      .run({ receipt: JSON.stringify(receipt), now: new Date().toISOString(), id });
  }

  markFailed(id: string, error: unknown): void {
    this.db
      .prepare(
        `UPDATE commands
         SET state = 'failed', error_json = @error, updated_at = @now
         WHERE id = @id`
      )
      .run({ error: JSON.stringify(error), now: new Date().toISOString(), id });
  }
}
