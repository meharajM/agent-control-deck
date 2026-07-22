PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pairing_sessions (
  nonce TEXT PRIMARY KEY,
  host_public_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS devices_public_key_unique
ON devices(public_key);

CREATE INDEX IF NOT EXISTS devices_status_public_key_idx
ON devices(status, public_key);

CREATE INDEX IF NOT EXISTS pairing_sessions_expires_idx
ON pairing_sessions(expires_at);
