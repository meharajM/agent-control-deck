# ADR 0004: SQLite for Bridge Persistence

## Status
Accepted

## Decision
Use SQLite in WAL mode for normalized state, command/approval ledgers, and event journal.

## Consequences

- Simple local deployment and transactions.
- Sufficient for single-host target.
- Requires careful migration/backup testing.
