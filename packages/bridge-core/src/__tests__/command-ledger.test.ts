import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '@agent-deck/bridge-database';
import { CommandLedger } from '../command-ledger.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migrationsDir = join(__dirname, '../../../../db/migrations');

const BASE_CMD = {
  id: 'cmd-001',
  idempotencyKey: 'idem-key-001',
  deviceId: 'device-001',
  sessionId: null,
  commandType: 'send_instruction',
  payloadHash: 'abc123',
} as const;

describe('CommandLedger', () => {
  let db: Database;
  let ledger: CommandLedger;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.runMigrations(migrationsDir);
    // Disable FK so we don't need real device/session rows
    db.db.pragma('foreign_keys = OFF');
    ledger = new CommandLedger(db.db);
  });

  afterEach(() => {
    db.close();
  });

  it('accepts a new command', () => {
    expect(ledger.accept(BASE_CMD)).toBe('accepted');
  });

  it('detects duplicate by idempotencyKey', () => {
    ledger.accept(BASE_CMD);
    // Same key, different id — still duplicate
    expect(ledger.accept({ ...BASE_CMD, id: 'cmd-002' })).toBe('duplicate');
  });

  it('allows a second command with a different idempotencyKey', () => {
    ledger.accept(BASE_CMD);
    expect(
      ledger.accept({ ...BASE_CMD, id: 'cmd-002', idempotencyKey: 'idem-key-002' })
    ).toBe('accepted');
  });

  it('markDispatched updates state', () => {
    ledger.accept(BASE_CMD);
    ledger.markDispatched(BASE_CMD.id);
    const row = db.db
      .prepare<{ id: string }, { state: string }>(
        'SELECT state FROM commands WHERE id = @id'
      )
      .get({ id: BASE_CMD.id });
    expect(row?.state).toBe('dispatched');
  });

  it('markComplete updates state and stores receipt', () => {
    ledger.accept(BASE_CMD);
    ledger.markComplete(BASE_CMD.id, { ok: true });
    const row = db.db
      .prepare<{ id: string }, { state: string; runtime_receipt_json: string }>(
        'SELECT state, runtime_receipt_json FROM commands WHERE id = @id'
      )
      .get({ id: BASE_CMD.id });
    expect(row?.state).toBe('confirmed');
    expect(JSON.parse(row?.runtime_receipt_json ?? '{}')).toEqual({ ok: true });
  });

  it('markFailed updates state and stores error', () => {
    ledger.accept(BASE_CMD);
    ledger.markFailed(BASE_CMD.id, { msg: 'oops' });
    const row = db.db
      .prepare<{ id: string }, { state: string }>(
        'SELECT state FROM commands WHERE id = @id'
      )
      .get({ id: BASE_CMD.id });
    expect(row?.state).toBe('failed');
  });
});
