# Bridge Agent Status

Updated: 2026-07-22

## Completed

- BRG-001 bridge-database (`packages/bridge-database/`)
  - Database class with WAL/FK/synchronous/busy_timeout pragmas
  - Numbered migrations with applied-migration tracking

- BRG-002 event-journal (`packages/bridge-core/src/event-journal.ts`)
  - Replay-safe append/getAfter/getLatestSequence behavior

- BRG-003 command-ledger (`packages/bridge-core/src/command-ledger.ts`)
  - Idempotent accept/dispatched/complete/failed command flow

- BRG-004 approval-CAS (`packages/bridge-core/src/approval-service.ts`)
  - First-writer-wins compare-and-set approval resolution

- BRG-005 snapshot (`packages/bridge-core/src/snapshot-service.ts`)
  - Session snapshot generation with pending approvals/questions

- BRG-006 fake-adapter (`packages/adapter-fake/`)
  - Scripted runtime scenarios plus fault-injection support for QA

- ADP-001 adapter-contract (`packages/adapter-contract/`)
  - RuntimeAdapter interface, AdapterEvent, ProbeResult, StartSessionParams, ReconcileResult

- BRG-007 bridge app and UCP gateway (`apps/bridge/`)
  - Bridge application and gateway are now present in-repo
  - Runtime-facing and phone-facing bridge layers exist for current integration work
  - Bridge code participates in the current green workspace baseline

- BRG-RUNTIME-001 Task 2 launch path
  - Root scripts select `fake`, `codex`, or `opencode` through `BRIDGE_RUNTIME`
  - README and readiness documentation describe each launch command

## In progress

- Default startup wiring for persisted host identity, durable pairing state, and authenticated encrypted transport
- Installer, start-on-login, and `doctor` validation for release readiness

## Blocked

- None at code level
- Release validation still depends on packaging evidence and physical-platform verification

## Paths owned

- `packages/bridge-database/**`
- `packages/bridge-core/**`
- `packages/adapter-contract/**`
- `packages/adapter-fake/**`
- `apps/bridge/**`

## Tests

- Bridge-layer tests, QA convergence and restart coverage, and the overall workspace baseline are currently green.
- Remaining missing evidence is release-oriented, not basic unit or integration coverage.

## Known limitations / follow-up

- Authenticated encrypted transport is implemented but not yet the fully locked default startup path.
- Durable persistence for pairing nonces and device grants remains follow-up work.
- Installer packaging, bundled Node validation, and operator-facing `doctor` coverage remain open.

## Suggested reviewer

Protocol/schema agent for wire-shape alignment, security agent for startup and auth wiring, QA agent for release-gate evidence.
