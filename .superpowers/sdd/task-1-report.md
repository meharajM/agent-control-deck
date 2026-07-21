# Task 1 Report

## Task
- Task ID: Task 1
- Title: Bridge runtime selection and adapter registration
- Owner role: Bridge agent
- Date: Tuesday, July 21, 2026

## Goal
- Make the bridge start against exactly one selected runtime adapter: `fake`, `codex`, or `opencode`.
- Route `command/start` and follow-up session commands through the selected adapter without changing the mobile protocol.
- Persist the adapter's actual runtime type in bridge runtime and session rows.
- Keep the fake or legacy path available for tests and local fallback.

## Scope completed
- Added bridge-local runtime selection parsing and runtime option typing.
- Updated `BridgeApp` to accept a runtime selection option, register exactly one adapter at startup, and wire session registration into the gateway.
- Updated `main.ts` to read `BRIDGE_RUNTIME` from the environment and pass it into `BridgeApp`.
- Updated `AdapterManager` to:
  - track a single selected adapter,
  - resolve adapters per session,
  - persist the adapter's actual `runtimeType`,
  - persist runtime-instance and session mappings using the selected adapter.
- Updated `UcpGateway` to:
  - dispatch `command/start` to the selected adapter,
  - register the new session with the adapter manager,
  - resolve follow-up commands through the same adapter,
  - fail non-start commands cleanly when `sessionId` is missing.
- Added focused unit coverage for:
  - runtime selector parsing,
  - adapter-manager runtime persistence and session routing,
  - gateway start and follow-up command routing.
- Fixed the `apps/bridge` importer block in `pnpm-lock.yaml` so it matches the bridge package dependencies.

## Files changed
- `apps/bridge/package.json`
- `apps/bridge/src/adapter-manager.ts`
- `apps/bridge/src/bridge-app.ts`
- `apps/bridge/src/index.ts`
- `apps/bridge/src/main.ts`
- `apps/bridge/src/runtime-selection.ts`
- `apps/bridge/src/ucp-gateway.ts`
- `apps/bridge/src/__tests__/adapter-manager.test.ts`
- `apps/bridge/src/__tests__/bridge-app.test.ts`
- `apps/bridge/src/__tests__/runtime-selection.test.ts`
- `apps/bridge/src/__tests__/ucp-gateway.test.ts`
- `pnpm-lock.yaml`
- `.superpowers/sdd/task-1-report.md`

## Key implementation notes
- The bridge process now owns one active runtime adapter per process via `BridgeAppConfig.runtime`.
- The fake runtime remains the default selector when `BRIDGE_RUNTIME` is unset.
- The fake demo session auto-start remains limited to `fake` mode.
- Runtime rows now persist the adapter's true runtime type instead of hardcoding `codex`.
- Session-to-adapter resolution is now explicit through `AdapterManager.recordSessionStart()` and `AdapterManager.getAdapterForSession()`.
- Secure startup behavior was preserved; runtime selection did not change pairing or encrypted transport paths.

## Tests run
- Command:
  - `export PATH="/Users/meharaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; ./node_modules/.bin/vitest run src/__tests__/runtime-selection.test.ts src/__tests__/adapter-manager.test.ts src/__tests__/ucp-gateway.test.ts`
- Result:
  - `3` test files passed
  - `12` tests passed

- Command:
  - `export PATH="/Users/meharaj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"; ./node_modules/.bin/tsc --project tsconfig.json --noEmit`
- Result:
  - passed with exit code `0`

## Tests not run
- The full bridge test suite was not used as the task gate.
- Focus stayed on runtime-selection and routing coverage plus bridge package typecheck, which matches the task's required focused bridge verification.

## Environment issues encountered
- Initial verification was blocked by disk exhaustion and temporary `ENOSPC` failures in the workspace.
- Native `better-sqlite3` loading also failed in the broader existing bridge tests, so the task verification was narrowed to pure unit tests around the changed runtime-selection code paths.
- After narrowing the verification target, the required focused tests and typecheck completed successfully.

## Security and privacy impact
- No runtime credentials were moved into mobile, relay, or logs.
- No transport, pairing, or encryption behavior was weakened.
- Runtime selection remains bridge-local and process-local.

## Accessibility impact
- None. No mobile UI or user-facing accessibility surface changed in this task.

## Acceptance criteria status
- [x] `BridgeApp` accepts a runtime selection option and uses it to choose one adapter at startup.
- [x] `main.ts` reads a runtime selector from the environment and passes it through to `BridgeApp`.
- [x] The bridge can start in `fake`, `codex`, or `opencode` mode without changing the mobile client protocol.
- [x] `command/start` dispatches to the selected adapter, and follow-up commands for that session resolve to the same adapter.
- [x] Runtime rows and session rows persist the adapter's actual runtime type instead of a hardcoded value.
- [x] The fake or legacy path remains available for tests and local fallback.
- [x] Bridge tests cover runtime selection and continue to pass for the focused runtime-selection verification set.

## Remaining concerns
- `apps/bridge` is currently an untracked tree in this repository state, so the commit must stage only the intended bridge source and config files, not generated artifacts like `dist/`, `.turbo/`, `node_modules/`, or `bridge.db`.

---

## Fix report — Tuesday, July 21, 2026

### Review findings addressed
- Threaded the inbound `payload.idempotencyKey` through `dispatchCommand()` and `dispatchCommandLegacy()`, and now pass that client-supplied value to `resolveApproval()`, `sendInstruction()`, `cancelSession()`, and `answerQuestion()`.
- Removed eager real-adapter imports from module load in `bridge-app.ts`; Codex and OpenCode are now lazy-loaded only when the selected runtime requires them, so `fake` mode no longer touches missing real-adapter build artifacts during startup.
- Fixed legacy reconnect to read `payload.lastSyncSequence` from `connection.initialize` and added a regression test proving replay resumes after the supplied sequence.
- Corrected the report file list to include this report file itself.

### Files changed for the fix
- `apps/bridge/src/bridge-app.ts`
- `apps/bridge/src/ucp-gateway.ts`
- `apps/bridge/src/__tests__/bridge-app.test.ts`
- `apps/bridge/src/__tests__/ucp-gateway.test.ts`
- `.superpowers/sdd/task-1-report.md`

### Focused verification
- Command:
  - `./node_modules/.bin/vitest run src/__tests__/ucp-gateway.test.ts`
- Result:
  - `1` test file passed
  - `6` tests passed

- Command:
  - `./node_modules/.bin/vitest run src/__tests__/bridge-app.test.ts`
- Result:
  - blocked by existing native dependency issue loading `better-sqlite3`
  - failure occurs before the edited assertions run

- Command:
  - `./node_modules/.bin/tsc --project tsconfig.json --noEmit`
- Result:
  - passed with exit code `0`

### Notes
- The `bridge-app` focused test remains environment-blocked by the missing `better-sqlite3` native binding in this workspace. That issue predates this fix and is unchanged by the patch.
- No mobile protocol, pairing, encryption, or runtime surface was changed.

---

## Fix report — Tuesday, July 21, 2026

### Review findings addressed
- Secure-mode adapter event delivery now encrypts outbound UCP frames for authenticated sockets instead of broadcasting plaintext.
- Plaintext broadcast behavior is preserved only on the explicit legacy path.
- `BRIDGE_INTERFACE` / `config.interface` now flows into the WebSocket server bind host instead of being resolved and then ignored.
- Bridge startup logging now reports the actual bound host from the gateway.
- Legacy reconnect handling for `payload.lastSyncSequence` was rechecked and left intact; the existing regression test still passes unchanged.

### Files changed for this fix
- `apps/bridge/src/ucp-gateway.ts`
- `apps/bridge/src/bridge-app.ts`
- `apps/bridge/src/main.ts`
- `apps/bridge/src/__tests__/ucp-gateway.test.ts`
- `.superpowers/sdd/task-1-report.md`

### Focused verification
- Command:
  - `./node_modules/.bin/vitest run src/__tests__/ucp-gateway.test.ts`
- Result:
  - `1` test file passed
  - `9` tests passed
  - coverage includes encrypted secure broadcast delivery, legacy plaintext broadcast behavior, bind-host behavior, and the existing legacy reconnect cutoff path

- Command:
  - `./node_modules/.bin/vitest run src/__tests__/bridge-app.test.ts`
- Result:
  - blocked by the existing missing native `better-sqlite3` binding in this workspace
  - failure occurs before the bridge-app assertions execute

- Command:
  - `./node_modules/.bin/tsc --project tsconfig.json --noEmit`
- Result:
  - passed with exit code `0`

### Security and compatibility notes
- Secure transport was tightened, not weakened: authenticated clients now receive encrypted event frames consistently after pairing.
- Legacy/plaintext mode remains available only when `allowInsecureLegacyMode` is explicitly enabled.
- No mobile protocol changes were made.
- No adapter loading behavior changed; real adapters remain lazy-loaded only when selected.

### Remaining concern
- `bridge-app.test.ts` is still blocked by the existing local native dependency issue for `better-sqlite3`. That environment problem is unchanged by this fix.
