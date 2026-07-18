# Bridge Agent Status

Updated: 2026-07-19

## Completed

- BRG-001 bridge-database (`packages/bridge-database/`)
  - Database class with WAL/FK/synchronous/busy_timeout pragmas
  - runMigrations: reads numbered SQL files, applies in transaction, tracks in bridge_metadata
  - Tests: table presence, idempotency, applied-migration tracking

- BRG-002 event-journal (`packages/bridge-core/src/event-journal.ts`)
  - append, getAfter, getLatestSequence
  - INSERT OR IGNORE on event_id for safe replay idempotency

- BRG-003 command-ledger (`packages/bridge-core/src/command-ledger.ts`)
  - accept (INSERT OR IGNORE on idempotency_key) → 'accepted' | 'duplicate'
  - markDispatched, markComplete, markFailed

- BRG-004 approval-CAS (`packages/bridge-core/src/approval-service.ts`)
  - create, resolve (compare-and-set on version), get, getPending
  - Concurrent resolve: DB-level CAS with changes-count guard

- BRG-005 snapshot (`packages/bridge-core/src/snapshot-service.ts`)
  - getSessionSnapshot: session row + pending approvals + pending questions

- BRG-006 fake-adapter (`packages/adapter-fake/`)
  - FakeAdapter: EventEmitter-based, scripted scenarios with delays
  - Default scenario: session.started → approval.requested → session.completed
  - All RuntimeAdapter methods implemented (in-memory, no real runtime)

- ADP-001 adapter-contract (`packages/adapter-contract/`)
  - RuntimeAdapter interface, AdapterEvent, ProbeResult, StartSessionParams, ReconcileResult

## In progress

- BRG-007 UCP WebSocket gateway — deferred, requires `ws` dependency and monorepo install to build/test. Skeleton not started to avoid uncommitted dead code.

## Blocked

- None currently. `pnpm install` not run per task constraints; tests pending install.

## Paths owned

- `packages/bridge-database/**`
- `packages/bridge-core/**`
- `packages/adapter-contract/**`
- `packages/adapter-fake/**`

## Tests

All test files created alongside implementation. Run with:

```bash
pnpm install --frozen-lockfile
pnpm --filter @agent-deck/bridge-database test
pnpm --filter @agent-deck/bridge-core test
pnpm --filter @agent-deck/adapter-fake test
```

Tests not run: `pnpm install` was not executed per task constraints.

## Known limitations / follow-up

- bridge-core tests import `@agent-deck/bridge-database` via workspace — needs install for resolution.
- adapter-fake tests import `@agent-deck/adapter-contract` via workspace — same.
- EventJournal.append uses random UUID per call; callers wanting deterministic replay should pass their own event_id (future API extension).
- SnapshotService reads live tables — no cached serialised snapshots yet (per DATA_MODEL.md §7 note: optional after profiling).
- BRG-007 (UCP WebSocket gateway) not started — `ws` package not in any package.json yet; coordinate with protocol agent before implementing gateway framing.

## Suggested reviewer

Protocol/schema agent (for event shape alignment) + QA agent (for conformance suite readiness).
