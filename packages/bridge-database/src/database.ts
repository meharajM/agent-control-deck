import BetterSqlite3 from 'better-sqlite3';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class Database {
  readonly db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
  }

  /**
   * Reads SQL files from migrationsDir in numeric order and applies unapplied ones.
   * Migration names tracked in bridge_metadata table under key 'applied_migrations'.
   */
  async runMigrations(migrationsDir: string): Promise<void> {
    // Use a dedicated tracking table separate from app-owned bridge_metadata
    // ponytail: simple text list in a single row, sufficient for sequential migrations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort(); // zero-padded filenames sort lexicographically == numeric order

    const appliedSet = new Set(
      this.db
        .prepare<[], { filename: string }>(`SELECT filename FROM _schema_migrations`)
        .all()
        .map((r) => r.filename)
    );

    const pending = files.filter((f) => !appliedSet.has(f));
    if (pending.length === 0) return;

    // Read all SQL files before entering the synchronous DB transaction
    const sqls = await Promise.all(
      pending.map((file) => readFile(join(migrationsDir, file), 'utf8'))
    );

    const insertApplied = this.db.prepare(
      `INSERT INTO _schema_migrations (filename, applied_at) VALUES (?, ?)`
    );

    this.db.transaction(() => {
      const now = new Date().toISOString();
      for (let i = 0; i < pending.length; i++) {
        this.db.exec(sqls[i] as string);
        insertApplied.run(pending[i], now);
      }
    })();
  }

  close(): void {
    this.db.close();
  }
}
