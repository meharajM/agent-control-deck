# Handoff: QA-003 Chaos Hardening

## Summary

Implemented Phase 6 reliability and chaos hardening: fault injection hooks in the fake adapter, 10 new chaos scenarios, convergence helpers, chaos/concurrency/convergence/performance tests, and extended test harness with fault injection API. All 193 tests pass across adapter-fake (7), bridge-core (32), and qa-scenarios (154).

## Files changed

### adapter-fake
- `packages/adapter-fake/src/fake-adapter.ts` — Added `injectFault()`, `clearFaults()`, `setApprovalRace()`, `setNetworkPartition()`, `setSlowResponse()`, `emitWithFaults()`, `applyFaultDelay()`, `seededRandom()` methods. Fault types: crash, delay, duplicate, reorder, drop.
- `packages/adapter-fake/src/scenarios/variants.ts` — Added 6 new scenarios: `crashRecoveryScenario`, `networkPartitionScenario`, `duplicateEventsScenario`, `reorderedEventsScenario`, `largePayloadFuzzScenario`, `backpressureScenario`. Updated `scenarioRegistry`.
- `packages/adapter-fake/src/index.ts` — Exported new `FaultType` type and new scenario variants.

### qa-scenarios
- `packages/qa-scenarios/src/convergence.ts` — New file. Convergence helpers: `assertReplayEqualsSnapshot`, `assertIdempotent`, `assertVersionMonotonic`, `assertNoDuplicateDispatch`, `assertConverged`. Exported `ConvergeResult` and `ReplayResult` types.
- `packages/qa-scenarios/src/harness.ts` — Added fault injection API: `injectFault()`, `clearFaults()`, `setApprovalRace()`, `setNetworkPartition()`, `setSlowResponse()`, `simulateDeviceCount()`, `captureState()`, `assertConverged()`, `assertReplayEqualsSnapshot()`, `getSessionId()`, `getAdapter()`. Fixed `onAdapterEvent` to update DB session state on terminal events.
- `packages/qa-scenarios/src/runner.ts` — Added `runChaosScenario()`, `runConvergenceTest()`, `runPerformanceTest()` functions with `ChaosRunResult`, `ConvergenceTestResult`, `PerformanceTestResult` types.
- `packages/qa-scenarios/src/scenarios/network-transition.ts` — Wi-Fi → cellular simulation.
- `packages/qa-scenarios/src/scenarios/two-device-race.ts` — Two devices racing on same approval.
- `packages/qa-scenarios/src/scenarios/bridge-restart.ts` — Bridge crash/restart recovery.
- `packages/qa-scenarios/src/scenarios/runtime-crash.ts` — Runtime crash mid-session.
- `packages/qa-scenarios/src/scenarios/socket-close-before-ack.ts` — Socket drop before ACK.
- `packages/qa-scenarios/src/scenarios/socket-close-after-ack.ts` — Socket drop after ACK.
- `packages/qa-scenarios/src/scenarios/clock-skew.ts` — Events with skewed timestamps.
- `packages/qa-scenarios/src/scenarios/performance.ts` — `buildPerformanceScenario()` and `buildReconnectEnduranceScenario()` with `PerformanceConfig`.
- `packages/qa-scenarios/src/index.ts` — Exported all new scenarios, convergence helpers, chaos runner functions, and types.
- `packages/qa-scenarios/src/__tests__/chaos.test.ts` — Extended from 7 to 20 tests: disconnect/duplicate/rapid-reconnect/completion/cancel/instruction/convergence + network-transition/two-device-race/bridge-restart/runtime-crash/socket-close/clock-skew/fault-injection.
- `packages/qa-scenarios/src/__tests__/convergence.test.ts` — 12 tests: replay=snapshot, idempotency, version monotonicity, no duplicate dispatch, state convergence.
- `packages/qa-scenarios/src/__tests__/concurrency.test.ts` — 8 tests: two-device approval race, concurrent approve/reject, phone disconnect no auto-approve, bridge restart no auto-approve, duplicate command prevention, state consistency.
- `packages/qa-scenarios/src/__tests__/performance.test.ts` — 4 tests: 100-session snapshot <5s, 100 reconnect cycles, happy-path timing, memory stability.

### bridge-core
- `packages/bridge-core/src/__tests__/approval-concurrency.test.ts` — 6 tests: CAS race (only first wins), sequential CAS, not_found, version conflict, device tracking, getPending.
- `packages/bridge-core/src/__tests__/replay-convergence.test.ts` — 9 tests: empty/single/multiple events, replay=snapshot after terminal event, idempotent replay, monotonic sequences, getAfter, getLatestSequence, independent sessions.

## Contracts used or changed

- `@agent-deck/adapter-contract` — Used `AdapterEvent`, `RuntimeAdapter`, `FaultType` (new export from adapter-fake)
- `@agent-deck/bridge-core` — Used `EventJournal`, `ApprovalService`, `SnapshotService`, `JournalEntry`, `SessionSnapshot`
- `@agent-deck/protocol` — Used `UcpEnvelope` types

## Tests run

```bash
pnpm --filter @agent-deck/adapter-fake test   # 7 passed
pnpm --filter @agent-deck/bridge-core test    # 32 passed
pnpm --filter @agent-deck/qa-scenarios test   # 154 passed
# Total: 193 passed, 0 failed
```

## Tests not run

- `pnpm test` (full workspace) — blocked by pre-existing `@agent-deck/crypto` build error (unrelated to this task)
- `pnpm --filter @agent-deck/mobile test` — mobile app tests, not part of this task scope

## Known limitations

- `buildPerformanceScenario` generates scenario steps but the harness adapter runs its own default scenario independently. Performance burst testing uses direct harness operations rather than scenario-driven adapter events.
- The chaos scenarios (`network-transition`, `two-device-race`, etc.) are defined as `Scenario` objects but are tested through direct harness operations rather than `ScenarioRunner` execution, because the runner's adapter event pipeline doesn't support injecting arbitrary scenario events into the journal.
- `setApprovalRace` and `simulateDeviceCount` are no-op placeholders — true multi-device simulation requires a second WebSocket client which is out of scope for the fake adapter.

## Security/privacy impact

- Chaos harness does not log or expose secrets, credentials, or private agent content
- Deterministic seeds (via `seededRandom`) are for reproducible test timing only
- Performance tests use synthetic data only
- No real runtime credentials used in any test

## Accessibility impact

None — backend/QA-only task.

## Follow-up tasks

- Implement true multi-device WebSocket simulation for two-device race testing at the protocol level
- Add 7-day endurance simulation (currently limited to 100 cycles due to test time constraints)
- Wire `buildPerformanceScenario` events through the adapter pipeline for end-to-end burst testing

## Suggested reviewer

QA/chaos/accessibility agent

## Reviewer note (2026-07-21)

The earlier workspace `pnpm test` blockage recorded above was an intermediate state during this task. The current repository-wide baseline is a green `pnpm test` and `pnpm typecheck`. The remaining QA-readiness gaps are release-evidence items, not missing harness coverage from this task.
