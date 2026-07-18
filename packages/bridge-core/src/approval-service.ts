import type BetterSqlite3 from 'better-sqlite3';

export interface ApprovalInput {
  id: string;
  sessionId: string;
  runtimeApprovalId: string;
  category: string;
  risk: string;
  reversible: string;
  title: string;
  summary: string;
  details?: unknown;
  decisions: unknown;
  expiresAt?: string | null;
}

interface ApprovalRow {
  id: string;
  session_id: string;
  runtime_approval_id: string;
  category: string;
  state: string;
  version: number;
  risk: string;
  reversible: string;
  title: string;
  summary: string;
  details_json: string;
  decisions_json: string;
  resolved_by_device_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface Approval {
  id: string;
  sessionId: string;
  runtimeApprovalId: string;
  category: string;
  state: string;
  version: number;
  risk: string;
  reversible: string;
  title: string;
  summary: string;
  details: unknown;
  decisions: unknown;
  resolvedByDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export class ApprovalService {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(input: ApprovalInput): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO approvals
           (id, session_id, runtime_approval_id, category, state, version,
            risk, reversible, title, summary, details_json, decisions_json,
            created_at, updated_at, expires_at)
         VALUES
           (@id, @sessionId, @runtimeApprovalId, @category, 'pending', 1,
            @risk, @reversible, @title, @summary, @detailsJson, @decisionsJson,
            @now, @now, @expiresAt)`
      )
      .run({
        id: input.id,
        sessionId: input.sessionId,
        runtimeApprovalId: input.runtimeApprovalId,
        category: input.category,
        risk: input.risk,
        reversible: input.reversible,
        title: input.title,
        summary: input.summary,
        detailsJson: JSON.stringify(input.details ?? {}),
        decisionsJson: JSON.stringify(input.decisions),
        now,
        expiresAt: input.expiresAt ?? null,
      });
  }

  /**
   * Compare-and-set approval resolution.
   * Returns 'resolved' on success, 'conflict' if version mismatch, 'not_found' if missing.
   */
  resolve(
    id: string,
    decision: string,
    deviceId: string,
    expectedVersion: number
  ): 'resolved' | 'conflict' | 'not_found' {
    const existing = this.db
      .prepare<{ id: string }, { version: number; state: string }>(
        `SELECT version, state FROM approvals WHERE id = @id`
      )
      .get({ id });

    if (!existing) return 'not_found';
    if (existing.version !== expectedVersion) return 'conflict';

    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `UPDATE approvals
         SET state = @decision,
             version = version + 1,
             resolved_by_device_id = @deviceId,
             updated_at = @now
         WHERE id = @id AND version = @expectedVersion`
      )
      .run({ decision, deviceId, now, id, expectedVersion });

    // Another writer raced us — second CAS guard
    return info.changes > 0 ? 'resolved' : 'conflict';
  }

  get(id: string): Approval | undefined {
    const row = this.db
      .prepare<{ id: string }, ApprovalRow>(
        `SELECT * FROM approvals WHERE id = @id`
      )
      .get({ id });
    return row ? toApproval(row) : undefined;
  }

  getPending(sessionId: string): Approval[] {
    const rows = this.db
      .prepare<{ sessionId: string }, ApprovalRow>(
        `SELECT * FROM approvals WHERE session_id = @sessionId AND state = 'pending' ORDER BY created_at ASC`
      )
      .all({ sessionId });
    return rows.map(toApproval);
  }
}

function toApproval(r: ApprovalRow): Approval {
  return {
    id: r.id,
    sessionId: r.session_id,
    runtimeApprovalId: r.runtime_approval_id,
    category: r.category,
    state: r.state,
    version: r.version,
    risk: r.risk,
    reversible: r.reversible,
    title: r.title,
    summary: r.summary,
    details: JSON.parse(r.details_json) as unknown,
    decisions: JSON.parse(r.decisions_json) as unknown,
    resolvedByDeviceId: r.resolved_by_device_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at,
  };
}
