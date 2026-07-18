# Data Model

## 1. Persistence principles

- SQLite in WAL mode
- Durable command acceptance before runtime dispatch
- Append-only normalized event journal
- Runtime remains authoritative for execution
- Bridge snapshots accelerate reconnect
- Minimal sensitive content retention
- Explicit migration versioning

## 2. Core entities

### Host metadata

Stores bridge identity, schema version, and snapshot watermark.

### Device

Paired phone/tablet identity, friendly name, grant status, last seen, revocation time.

### Runtime instance

Runtime kind, version, process mode, health, capability document.

### Session

Normalized state and mapping to runtime-native session ID.

### Event journal

Ordered durable normalized events for replay.

### Command

Idempotency ledger for phone-issued state changes.

### Approval/question

Human-in-the-loop state with optimistic concurrency.

### Notification outbox

Durable attention signals waiting for optional push delivery.

### Audit event

Security-relevant user and system action records.

## 3. SQLite settings

At startup:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

Security-sensitive deployments may choose `synchronous = FULL` after performance testing.

## 4. Session state

```text
idle
queued
running
waiting_user
waiting_approval
completed
failed
cancelled
interrupted
disconnected
unknown
```

## 5. Command state

```text
received
validated
accepted
dispatched
confirmed
failed
expired
```

## 6. Approval state

```text
pending
answering
approved
rejected
cancelled
expired
resolved_elsewhere
failed
```

## 7. Snapshot strategy

Maintain:

- Latest complete host snapshot
- Latest session version per session
- Watermark event sequence

A snapshot can be generated on demand from normalized tables. Optionally cache serialized snapshots after profiling.

## 8. Retention defaults

- Sessions and summaries: until user deletes/archives according to setting
- Event journal: seven days or 50,000 events, whichever limit is reached later within storage cap
- Commands: 30 days
- Security audit events: 90 days local default
- Push outbox: seven days
- Raw diagnostic payloads: disabled by default

## 9. Redaction and encryption

The bridge database may contain sensitive summaries. Protect the database with OS account permissions. A later hardening milestone may encrypt selected columns using a host key stored in the operating-system keychain.

Never store:

- Runtime passwords in ordinary config files
- Full mobile biometric data
- Relay content keys in relay storage
- Raw voice recordings after transcription completion, unless user explicitly enables retention

## 10. Concurrency

All approval transitions use compare-and-set against expected version.

All command insertions enforce unique idempotency keys.

All event appends and state updates occur in one database transaction when they represent one logical runtime event.

## 11. Migration rules

- Sequential numbered SQL files
- No destructive migration without backup/rollback plan
- Migration tests against previous two released database versions
- Bridge refuses to run against a newer unsupported schema
- Automatic backup before major migration

See `db/migrations/001_initial.sql` for the starter schema.
