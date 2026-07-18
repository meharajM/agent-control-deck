import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from '../database.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migrationsDir = join(__dirname, '../../../../db/migrations');

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('applies foreign_keys and synchronous pragmas', () => {
    // WAL mode does not apply to :memory: databases (SQLite always reports 'memory').
    // Verify the other pragmas are applied correctly instead.
    const fk = db.db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
    const sync = db.db.pragma('synchronous', { simple: true });
    expect(sync).toBe(1); // NORMAL = 1
  });

  it('runs migrations and creates all tables', async () => {
    await db.runMigrations(migrationsDir);

    const tables = db.db
      .prepare<[], { name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      )
      .all()
      .map((r) => r.name);

    const expected = [
      'approvals',
      'audit_events',
      'bridge_metadata',
      'commands',
      'devices',
      'event_journal',
      'notification_outbox',
      'questions',
      'runtime_instances',
      'sessions',
    ];
    for (const t of expected) {
      expect(tables).toContain(t);
    }
  });

  it('tracks applied migrations in _schema_migrations', async () => {
    await db.runMigrations(migrationsDir);

    const row = db.db
      .prepare<[], { filename: string }>(
        `SELECT filename FROM _schema_migrations WHERE filename = '001_initial.sql'`
      )
      .get();

    expect(row).toBeDefined();
    expect(row!.filename).toBe('001_initial.sql');
  });

  it('is idempotent — running migrations twice does not throw', async () => {
    await db.runMigrations(migrationsDir);
    await expect(db.runMigrations(migrationsDir)).resolves.toBeUndefined();
  });
});
