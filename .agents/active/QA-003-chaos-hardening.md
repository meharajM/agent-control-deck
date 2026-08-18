# Task: QA-003 Reliability and Chaos Hardening

## Owner role

QA/chaos/accessibility

## Goal

Build chaos fault-injection harness, network/process/event recovery tests, multi-device approval race tests, and performance/endurance suite to prove normalized state converges to runtime truth under all failure modes.

## Background

Phase 6 proves the system is reliable. The testing strategy (docs/development/TESTING_STRATEGY.md) defines the chaos matrix and synchronization invariants. Current test coverage is good for happy paths but lacks:

- Fault injection (network drop, process kill, DB lock)
- Multi-device approval race testing
- Reconnect/replay convergence proof
- Performance baseline (100 sessions snapshot, 1000 events/min burst)
- 7-day endurance simulation

## Dependencies

- Bridge core services (BRG-001–007) — DONE
- Fake adapter with scenario variants — DONE
- QA scenario runner and harness — DONE
- Mobile stores and connection state machine — DONE
- UCP protocol types and validation — DONE
- Adapter conformance suite — DONE

## Contracts consumed

- `packages/qa-scenarios/src/harness.ts` — scenario harness
- `packages/qa-scenarios/src/runner.ts` — scenario runner
- `packages/qa-scenarios/src/scenarios/*.ts` — existing scenarios
- `packages/adapter-fake/src/fake-adapter.ts` — fake adapter for fault injection
- `packages/bridge-core/src/event-journal.ts` — event sequencing
- `packages/bridge-core/src/approval-service.ts` — CAS semantics
- `packages/bridge-core/src/snapshot-service.ts` — snapshot/replay
- `apps/mobile/src/store/session-store.ts` — mobile state reducer
- `apps/mobile/src/services/bridge-connection.ts` — reconnect state machine

## Allowed paths

- `packages/qa-scenarios/src/**` (new chaos scenarios, harness extensions)
- `packages/qa-scenarios/src/__tests__/**` (chaos test execution)
- `packages/adapter-fake/src/**` (fault injection hooks in fake adapter)
- `packages/bridge-core/src/__tests__/**` (concurrency/isolation tests)

## Forbidden paths

- `apps/bridge/src/**` — no bridge app changes
- `apps/mobile/src/**` — no mobile app changes
- `packages/protocol/src/**` — no protocol changes
- `packages/bridge-database/src/**` — no database package changes
- `packages/adapter-codex/**`, `packages/adapter-opencode/**`, `packages/adapter-claude/**` — no adapter changes

## Acceptance criteria

- [ ] Chaos harness can inject: socket close before ACK, socket close after ACK before runtime confirm, bridge kill, adapter worker kill, runtime kill, DB busy/lock, duplicate frame, out-of-order frame, clock skew
- [ ] Network transition test: Wi-Fi → cellular simulation (disconnect, reconnect with new route)
- [ ] Two-device approval race: two phones answer same approval concurrently → only first wins, second gets APPROVAL_ALREADY_RESOLVED
- [ ] Duplicate command test: same idempotency key sent twice → only one runtime dispatch
- [ ] Reconnect replay test: phone reconnects with lastAcknowledgedSequence → receives only missed events, state matches full snapshot
- [ ] Snapshot reset test: expired cursor → phone receives full snapshot, state converges
- [ ] Bridge restart test: kill bridge, restart → fake sessions restored, phone reconnects and state converges
- [ ] Runtime crash test: fake adapter emits crash event → session marked failed/interrupted, no stale approval actionability
- [ ] Phone disconnect does NOT auto-approve pending approvals
- [ ] Bridge restart does NOT auto-approve pending approvals
- [ ] Performance: 100 sessions snapshot completes under 5 seconds
- [ ] Performance: 1000 normalized events/minute burst without data loss
- [ ] Endurance: 1000 reconnect cycles without unbounded memory growth
- [ ] All chaos tests use deterministic seeds for reproducibility
- [ ] Normalized state converges to runtime truth in ALL chaos scenarios

## Required tests

- `packages/qa-scenarios/src/__tests__/chaos.test.ts` — core chaos suite (extend existing)
- `packages/qa-scenarios/src/scenarios/network-transition.ts` — Wi-Fi/cellular switch
- `packages/qa-scenarios/src/scenarios/two-device-race.ts` — concurrent approval
- `packages/qa-scenarios/src/scenarios/bridge-restart.ts` — bridge crash recovery
- `packages/qa-scenarios/src/scenarios/runtime-crash.ts` — runtime failure
- `packages/qa-scenarios/src/scenarios/performance.ts` — burst/endurance
- `packages/bridge-core/src/__tests__/approval-concurrency.test.ts` — CAS race
- `packages/bridge-core/src/__tests__/replay-convergence.test.ts` — replay = snapshot

## Security/privacy considerations

- Chaos harness must not leak secrets in fault logs
- Deterministic seeds stored in test fixtures only, not in production code
- Performance tests use synthetic data, not real agent output

## Accessibility considerations

- None — this is a backend/QA-only task

## Handoff recipient

Release/packaging agent for release gate evidence
