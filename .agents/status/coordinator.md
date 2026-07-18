# Coordinator Status

Updated: 2026-07-19

## Completed
- UCP-001: Envelope types, Zod validators, fixtures, 10 tests
- UCP-002: Capabilities types, Zod validators, fixtures, 10 tests
- UCP-003: Command types, Zod validators, fixtures, 9 tests
- DB-001: SQLite migration 001_initial.sql — schema verified, 4 tests
- ADP-001: RuntimeAdapter interface (adapter-contract package)
- BRG-001: Bridge database — WAL, FK, migrations, 4 tests
- BRG-002: Event journal — append/getAfter, idempotency, 5 tests
- BRG-003: Command ledger — accept/duplicate, 6 tests
- BRG-004: Approval CAS — version-gated resolve, 6 tests
- BRG-005: Snapshot service — session state normalization
- BRG-006: Fake adapter — scripted scenario playback, 7 tests
- MOB-001: Navigation + session/connection stores, 9 tests
- MOB-002: Session cache schema (types.ts)
- MOB-003: Connection/reconnect state machine
- MOB-004: Session board screen
- MOB-005: Attention queue (approval/question lists)
- MOB-006: Approval/question screens
- MOB-007: Offline/stale behavior (disabled mutations)
- MOB-008: Accessibility baseline on all screens
- QA-001: Fake runtime scenario engine — 3 scenarios, 18 tests
- Monorepo bootstrap: pnpm workspace, turbo.json, tsconfig.base.json
- Root vitest config via per-package vitest.config.ts
- UCP client hostId fix, dead ternary fix, vitest migration

## In progress
- None — Wave 1 complete

## Blocked
- None

## Test results
- protocol: 29/29
- bridge-database: 4/4
- bridge-core: 17/17
- adapter-fake: 7/7
- qa-scenarios: 18/18
- mobile: 17/17
- **Total: 92/92 pass**

## Paths changed
- package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .gitignore, .nvmrc
- packages/protocol/**
- packages/bridge-database/**
- packages/bridge-core/**
- packages/adapter-contract/**
- packages/adapter-fake/**
- packages/qa-scenarios/**
- apps/mobile/**
- vitest configs (per-package)

## Next integration point
- Wave 2: fake-runtime vertical slice (BRG-007 UCP WebSocket gateway + fake adapter + mobile connect/disconnect)

## Risks
- React peer dep mismatch: react-native 0.85 wants react@^19.2.3, installed 19.2.0 — minor patch, not blocking
- `@react-native/jest-preset` unmet peer — removed from deps (using vitest now)
