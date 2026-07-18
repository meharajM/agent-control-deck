PRAGMA foreign_keys = ON;

CREATE TABLE bridge_metadata (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT,
  public_key TEXT NOT NULL,
  grant_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  paired_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE TABLE runtime_instances (
  id TEXT PRIMARY KEY,
  runtime TEXT NOT NULL CHECK (runtime IN ('codex', 'opencode', 'claude')),
  version TEXT,
  mode TEXT NOT NULL,
  state TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  last_probe_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  runtime_instance_id TEXT NOT NULL REFERENCES runtime_instances(id) ON DELETE CASCADE,
  runtime_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  project_name TEXT,
  project_path_hash TEXT,
  state TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  current_action TEXT,
  pending_approval_count INTEGER NOT NULL DEFAULT 0,
  pending_question_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_runtime_event_at TEXT,
  UNIQUE(runtime_instance_id, runtime_session_id)
);

CREATE TABLE event_journal (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX event_journal_session_sequence
ON event_journal(session_id, sequence);

CREATE TABLE commands (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL REFERENCES devices(id),
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  command_type TEXT NOT NULL,
  state TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  runtime_receipt_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  runtime_approval_id TEXT NOT NULL,
  category TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  risk TEXT NOT NULL,
  reversible TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  decisions_json TEXT NOT NULL,
  resolved_by_device_id TEXT REFERENCES devices(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  UNIQUE(session_id, runtime_approval_id)
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  runtime_question_id TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  prompt TEXT NOT NULL,
  options_json TEXT,
  answer_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, runtime_question_id)
);

CREATE TABLE notification_outbox (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  deduplication_key TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  expires_at TEXT
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
