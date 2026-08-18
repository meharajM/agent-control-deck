PRAGMA foreign_keys = ON;

ALTER TABLE pairing_sessions ADD COLUMN pairing_code TEXT;

CREATE UNIQUE INDEX pairing_sessions_active_code_unique
ON pairing_sessions(pairing_code)
WHERE pairing_code IS NOT NULL AND used_at IS NULL;
