import type BetterSqlite3 from 'better-sqlite3';

export interface QuestionInput {
  id: string;
  sessionId: string;
  runtimeQuestionId: string;
  prompt: string;
  options: unknown[] | null;
}

interface QuestionRow {
  id: string;
  session_id: string;
  runtime_question_id: string;
  state: string;
  version: number;
  prompt: string;
  options_json: string | null;
  answer_json: string | null;
  resolved_by_device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  sessionId: string;
  runtimeQuestionId: string;
  state: string;
  version: number;
  prompt: string;
  options: unknown[] | null;
  answer: unknown;
  resolvedByDeviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class QuestionService {
  constructor(private readonly db: BetterSqlite3.Database) {}

  create(input: QuestionInput): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO questions
           (id, session_id, runtime_question_id, state, version, prompt, options_json, created_at, updated_at)
         VALUES
           (@id, @sessionId, @runtimeQuestionId, 'pending', 1, @prompt, @optionsJson, @now, @now)`
      )
      .run({
        id: input.id,
        sessionId: input.sessionId,
        runtimeQuestionId: input.runtimeQuestionId,
        prompt: input.prompt,
        optionsJson: input.options ? JSON.stringify(input.options) : null,
        now,
      });
  }

  resolve(
    id: string,
    answer: unknown,
    deviceId: string,
    expectedVersion: number
  ): 'resolved' | 'conflict' | 'not_found' {
    const existing = this.db
      .prepare<{ id: string }, { version: number; state: string }>(
        `SELECT version, state FROM questions WHERE id = @id`
      )
      .get({ id });

    if (!existing) return 'not_found';
    if (existing.version !== expectedVersion) return 'conflict';

    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `UPDATE questions
         SET state = 'answered',
             answer_json = @answerJson,
             version = version + 1,
             resolved_by_device_id = @deviceId,
             updated_at = @now
         WHERE id = @id AND version = @expectedVersion`
      )
      .run({
        answerJson: JSON.stringify(answer),
        deviceId,
        now,
        id,
        expectedVersion,
      });

    return info.changes > 0 ? 'resolved' : 'conflict';
  }

  getPending(sessionId: string): Question[] {
    const rows = this.db
      .prepare<{ sessionId: string }, QuestionRow>(
        `SELECT * FROM questions WHERE session_id = @sessionId AND state = 'pending' ORDER BY created_at ASC`
      )
      .all({ sessionId });
    return rows.map(toQuestion);
  }
}

function toQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    sessionId: r.session_id,
    runtimeQuestionId: r.runtime_question_id,
    state: r.state,
    version: r.version,
    prompt: r.prompt,
    options: r.options_json ? (JSON.parse(r.options_json) as unknown[]) : null,
    answer: r.answer_json ? JSON.parse(r.answer_json) as unknown : null,
    resolvedByDeviceId: r.resolved_by_device_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
