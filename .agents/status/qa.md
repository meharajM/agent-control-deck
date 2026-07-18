# QA Agent Status

Updated: 2026-07-19

## Completed

- QA-001: Fake scenario engine with 3 deterministic scenarios:
  - `happy-path`: session.created → approval.requested (medium risk, command) → approval.resolved (approve) → session.completed
  - `reconnect`: session.created → approval.requested → DISCONNECT sentinel → RECONNECT sentinel → approval.resolved → session.completed
  - `duplicate-command`: session.created → COMMAND_SEND (accepted) → COMMAND_SEND (same idempotencyKey, expected: duplicate)
- Scenario type definitions (`scenario-types.ts`)
- Vitest test suite covering step counts, ordering, sentinel positions, ID uniqueness

## In progress

- QA-002: Conformance suite — pending adapter-contract merge

## Blocked

None

## Notes

- DISCONNECT/RECONNECT/COMMAND_SEND are sentinel step types consumed by the bridge integration harness, not emitted to the mobile store directly.
- Scenario IDs are unique by design; test enforces this.
- All scenarios have deterministic delayMs values for repeatable replay.
