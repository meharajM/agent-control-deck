# Initial Task Backlog

V1 runtime scope is limited to Codex and OpenCode. Tasks for other runtimes remain visible for post-v1 planning but are not v1 dependencies or release gates.

## Contracts

- **UCP-001:** Implement envelope schemas and fixture validator
- **UCP-002:** Implement capabilities/session/approval schemas
- **UCP-003:** Generate TypeScript types from schemas
- **DB-001:** Apply and test initial SQLite migration
- **ADP-001:** Implement adapter contract package

## Bridge

- **BRG-001:** Bridge process bootstrap and config loading
- **BRG-002:** Event journal and sequence allocation
- **BRG-003:** Command idempotency service
- **BRG-004:** Approval compare-and-set service
- **BRG-005:** Snapshot/replay service
- **BRG-006:** Fake adapter supervisor
- **BRG-007:** UCP WebSocket gateway

## Mobile

- **MOB-001:** Navigation and local state store
- **MOB-002:** Host/session cache schema
- **MOB-003:** Connection/reconnect state machine
- **MOB-004:** Initial session board (superseded by MOB-009 control deck)
- **MOB-005:** Initial attention queue (consolidated into MOB-009)
- **MOB-006:** Approval/question screens
- **MOB-007:** Offline/stale behavior
- **MOB-008:** Accessibility baseline
- **MOB-009:** Single-screen agent control deck, completion retention, configurable commands, and desktop-focus UX

## Codex

- **CDX-001:** Binary/version discovery
- **CDX-002:** Schema generation/import
- **CDX-003:** App-server lifecycle/handshake
- **CDX-004:** Thread/turn/item normalization
- **CDX-005:** Approval/question handling
- **CDX-006:** Reconciliation and restart tests

## OpenCode

- **OPC-001:** Server lifecycle/authentication
- **OPC-002:** OpenAPI/SDK client
- **OPC-003:** SSE and session normalization
- **OPC-004:** Permission and diff handling
- **OPC-005:** Reconciliation tests

## Security/networking

- **SEC-001:** Host/device identity abstraction
- **SEC-002:** One-time four-digit local pairing
- **SEC-003:** Direct application-encrypted WebSocket
- **SEC-004:** Secure mobile key storage
- **SEC-005:** Revocation
- **NET-001:** LAN discovery and route selection
- **NET-002:** Private-network endpoint mode

## Post-v1 Claude beta

- **CLD-001:** Current Agent SDK query/session wrapper
- **CLD-002:** Resume/fork/session listing
- **CLD-003:** Permission and user-input bridge
- **CLD-004:** Streaming normalization
- **CLD-005:** Recovery/limitations tests

## Quality

- **QA-001:** Fake runtime scenario engine
- **QA-002:** Adapter conformance suite
- **QA-003:** Chaos network/process harness
- **QA-004:** Mobile E2E happy path
- **QA-005:** VoiceOver/TalkBack test plan
- **QA-006:** Performance/endurance suite

## Stack readiness spikes

- **SPIKE-001:** Expo SDK 56 iOS/Android development build in pnpm hoisted monorepo
- **SPIKE-002:** Direct LAN application-encrypted WebSocket on physical iPhone and Android
- **SPIKE-003:** Bundled Node 24 plus better-sqlite3 installer smoke test per host OS
- **SPIKE-004:** Maestro pairing/session/approval flow on iOS simulator and Android emulator
- **SPIKE-005:** Codex app-server start/stream/approval proof
- **SPIKE-006:** OpenCode server SSE/permission proof
- **SPIKE-007:** Claude query/stream/interrupt/canUseTool proof (post-v1; not a v1 gate)
- **SPIKE-008:** Internet-blocked local-only end-to-end test
