import type BetterSqlite3 from 'better-sqlite3';

interface SessionRow {
  id: string;
  runtime_instance_id: string;
  runtime_session_id: string;
  title: string;
  project_name: string | null;
  state: string;
  summary: string;
  current_action: string | null;
  pending_approval_count: number;
  pending_question_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface ApprovalRow {
  id: string;
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
  expires_at: string | null;
}

interface QuestionRow {
  id: string;
  runtime_question_id: string;
  state: string;
  version: number;
  prompt: string;
  options_json: string | null;
}

export interface SessionSnapshot {
  session: SessionRow | null;
  pendingApprovals: ApprovalRow[];
  pendingQuestions: QuestionRow[];
}

/**
 * SnapshotService generates normalized session state on demand from DB tables.
 * // ponytail: in-memory only, replace with persistent store if throughput requires
 */
export class SnapshotService {
  constructor(private readonly db: BetterSqlite3.Database) {}

  getSessionSnapshot(sessionId: string): SessionSnapshot {
    const session =
      this.db
        .prepare<{ sessionId: string }, SessionRow>(
          `SELECT id, runtime_instance_id, runtime_session_id, title, project_name,
                  state, summary, current_action, pending_approval_count,
                  pending_question_count, version, created_at, updated_at
           FROM sessions WHERE id = @sessionId`
        )
        .get({ sessionId }) ?? null;

    const pendingApprovals = this.db
      .prepare<{ sessionId: string }, ApprovalRow>(
        `SELECT id, runtime_approval_id, category, state, version, risk,
                reversible, title, summary, details_json, decisions_json, expires_at
         FROM approvals
         WHERE session_id = @sessionId AND state = 'pending'
         ORDER BY created_at ASC`
      )
      .all({ sessionId });

    const pendingQuestions = this.db
      .prepare<{ sessionId: string }, QuestionRow>(
        `SELECT id, runtime_question_id, state, version, prompt, options_json
         FROM questions
         WHERE session_id = @sessionId AND state = 'pending'
         ORDER BY created_at ASC`
      )
      .all({ sessionId });

    return { session, pendingApprovals, pendingQuestions };
  }
}
