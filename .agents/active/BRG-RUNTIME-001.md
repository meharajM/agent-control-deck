# BRG-RUNTIME-001 — Codex/OpenCode bridge runtime selection

## Task 1

## Owner role
Bridge agent

## Goal
Wire the bridge so it can start against exactly one selected runtime adapter: `fake`, `codex`, or `opencode`. The bridge must route all session commands to that selected adapter, persist the actual runtime type in the database, and keep the current fake/legacy test path working.

## Background
The current bridge bootstrap still registers the fake adapter only, and the adapter manager persists runtime rows with a hardcoded runtime name. Codex and OpenCode adapter packages already exist in the workspace and need to be reachable from the bridge entrypoint.

## Dependencies
- `packages/adapter-codex`
- `packages/adapter-opencode`
- `packages/adapter-fake`
- `apps/bridge/src/ucp-gateway.ts`
- `apps/bridge/src/adapter-manager.ts`
- `apps/bridge/src/bridge-app.ts`
- `apps/bridge/src/main.ts`

## Contracts consumed
- `docs/architecture/RUNTIME_ADAPTERS.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`
- `packages/adapter-contract`

## Allowed paths
- `apps/bridge/src/**`
- `apps/bridge/package.json`
- `pnpm-lock.yaml`

## Forbidden paths
- `apps/mobile/**`
- `packages/adapter-codex/**`
- `packages/adapter-opencode/**`
- `packages/adapter-fake/**`
- `docs/**`
- `db/migrations/**`

## Acceptance criteria
- [ ] `BridgeApp` accepts a runtime selection option and uses it to choose one adapter at startup.
- [ ] `main.ts` reads a runtime selector from the environment and passes it through to `BridgeApp`.
- [ ] The bridge can start in `fake`, `codex`, or `opencode` mode without changing the mobile client protocol.
- [ ] `command/start` dispatches to the selected adapter, and follow-up commands for that session resolve to the same adapter.
- [ ] Runtime rows and session rows persist the adapter's actual runtime type instead of a hardcoded value.
- [ ] The fake/legacy path remains available for tests and local fallback.
- [ ] Bridge tests cover runtime selection and continue to pass for the fake mode.

## Required tests
- Bridge unit/integration tests covering runtime selection and session routing.
- TypeScript build/typecheck for the bridge package.

## Security/privacy considerations
- Do not move runtime credentials or prompt content into logs.
- Keep secure bridge startup as the default behavior; runtime selection must not weaken pairing or encrypted transport.

## Accessibility considerations
- No new user-facing mobile surface is required for this task.

## Handoff recipient
Bridge agent / integration reviewer

## Task 2

## Owner role
Bridge release / documentation agent

## Goal
Add the user-facing bridge launch scripts and update the repo docs so the selected runtime is obvious and reproducible for Codex and OpenCode runs.

## Background
The runtime selector added in Task 1 needs a simple launch path for local use, plus documentation and readiness notes that describe how to start the bridge with each runtime.

## Dependencies
- Task 1 implementation

## Contracts consumed
- `README.md`
- `docs/planning/IMPLEMENTATION_READINESS_CHECKLIST.md`
- `docs/planning/VALIDATION_REPORT.md`

## Allowed paths
- `package.json`
- `README.md`
- `docs/planning/IMPLEMENTATION_READINESS_CHECKLIST.md`
- `docs/planning/VALIDATION_REPORT.md`
- `.agents/status/bridge.md`

## Forbidden paths
- `apps/bridge/src/**`
- `apps/mobile/**`
- `packages/**`
- `db/**`
- `schemas/**`

## Acceptance criteria
- [ ] Root scripts provide explicit launch commands for bridge runs with `fake`, `codex`, and `opencode`.
- [ ] README documents the runtime selector and the bridge launch commands clearly.
- [ ] The readiness checklist and validation report reflect the new runtime-selection capability.
- [ ] Bridge status notes are synced if they need to mention the new launch path.

## Required tests
- No code-path tests required; verify the script and doc edits are internally consistent.

## Security/privacy considerations
- Documentation must not expose credentials or private endpoints.

## Accessibility considerations
- Ensure any doc text uses plain, explicit language and avoids ambiguous operator instructions.

## Handoff recipient
Bridge agent / release coordination
