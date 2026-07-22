# Development Plan

## 1. Goal

Deliver a local-first Android/iOS application and host bridge that can safely supervise Codex and OpenCode sessions. Claude Agent SDK sessions are explicitly post-v1. Optional hosted infrastructure is deferred until core local reliability is proven.

## 2. Delivery strategy

Build vertical slices using a fake adapter before integrating real runtimes. Lock protocol, persistence, and failure semantics early. Defer voice and managed relay until session/approval reliability is proven.

## 3. Team assumption

Baseline estimate assumes:

- Two full-time engineers
- Part-time product design
- Part-time security review
- Part-time QA/accessibility support

A multi-agent coding workflow is described separately.

## 3.1 Current implementation snapshot

Validated repository status as of 2026-07-21:

- Phases 0 through 4 are implemented in-repo: protocol and contracts, bridge core, mobile supervision flows, fake-runtime vertical slice, and Codex and OpenCode adapter foundations.
- The workspace baseline is currently a green `pnpm test` and `pnpm typecheck`.
- Phase 5 pairing and security networking, Phase 6 chaos hardening, and Phase 7 private-network mode all have implementation in the tree but are not yet fully release-gated.
- Remaining v1 QA-readiness work is concentrated in secure startup wiring, device and Maestro validation evidence, packaging and start-on-login validation, and documented networking stubs.

## 4. Phase plan

### Phase 0 — Architecture and contracts

**Duration:** 1–2 weeks

Deliver:

- Product scope and non-goals
- UCP v1 draft and schemas
- Adapter contract
- SQLite model
- Threat model
- UX wireframes
- Fake runtime scenario catalogue

Exit criteria:

- No unresolved trust-boundary issue
- Command and approval semantics agreed
- Protocol fixtures validate

### Phase 1 — Bridge core and fake adapter

**Duration:** 2–3 weeks

Deliver:

- Monorepo bootstrap
- Bridge daemon
- Database migrations
- Event journal
- Command/approval ledgers
- Fake adapter
- UCP WebSocket gateway
- CLI status and doctor commands

Exit criteria:

- Duplicate commands do not re-execute
- Replay and snapshot work
- Bridge restart restores fake sessions

### Phase 2 — Mobile vertical slice

**Duration:** 2–3 weeks

Deliver:

- Pair-development host flow
- Attention screen
- Session board/detail
- Approval and question UI
- Text steering
- Mobile cache
- Reconnect state machine
- Baseline accessibility

Exit criteria:

- Full fake-agent flow on physical iOS and Android
- Offline data visibly stale
- Dangerous controls disabled offline

### Phase 3 — Codex adapter

**Duration:** 3–4 weeks

Deliver:

- Binary/version discovery
- App-server lifecycle
- Version-matched schemas
- Threads/turns/items
- Streaming
- Steering/cancel
- Structured approvals/questions
- Restart reconciliation

Exit criteria:

- Adapter contract suite passes
- Pending approval recovery proven
- Compatibility warning behavior implemented

### Phase 4 — OpenCode adapter

**Duration:** 2–3 weeks

Deliver:

- Managed/existing server modes
- Health/version
- SDK/OpenAPI client
- SSE subscription
- Sessions/status/messages
- Diff previews
- Permission answers
- Abort/reconcile

Exit criteria:

- Adapter contract suite passes
- Server remains loopback-only behind bridge

### Phase 5 — Pairing, direct networking, secure storage

**Duration:** 3–4 weeks

Deliver:

- Host/device identity
- One-time QR pairing
- Direct application-encrypted WebSocket
- Interface selection
- QR/manual endpoint connection; optional mDNS after MVP
- Device revocation
- iOS Keychain/Android Keystore integration
- Biometric policy

Exit criteria:

- No unauthenticated control path
- QR replay fails
- Revoked active device disconnects

Current state:

- Core crypto, QR payload, device-grant, and biometric-gate implementation exists in the repository.
- Release-gate integration is still open for durable nonces and device grants and for making authenticated encrypted transport the default bridge startup path.

### Phase 6 — Reliability and chaos hardening

**Duration:** 2–3 weeks

Deliver:

- Network handoff
- Event replay and snapshot reset
- Multi-device approval race
- Runtime crash recovery
- Bridge crash recovery
- Database integrity/recovery
- Performance/load tests

Exit criteria:

- Normalized state converges to runtime state under fault injection
- No duplicate state-changing action in simulation target

Current state:

- Convergence, replay and idempotency, approval race, restart, and performance scenario coverage exist in `packages/qa-scenarios`.
- Remaining QA work is system-level evidence such as physical-device and Maestro flows and no-internet release validation.

### Phase 7 — Private-network mode

**Duration:** 1–2 weeks

Deliver:

- Manual Tailscale/private endpoint
- Route selection
- Route diagnostics
- Direct/private fallback

Exit criteria:

- Remote operation works without vendor server

Current state:

- Route selection, diagnostics, private endpoint configuration, and bridge interface binding are implemented.
- The current implementation still carries documented stubs for network ID detection, latency correlation, and interface-to-IP resolution.

### Phase 8 — V1 accessibility hardening

**Duration:** 2–3 weeks

Deliver:

- Preserve text and OS keyboard dictation parity
- Editable drafts
- VoiceOver/TalkBack completion
- Large text/high contrast/reduced motion

Exit criteria:

- Full text-only parity
- Core Codex/OpenCode flow passes VoiceOver/TalkBack review

### Phase 9 — V1 release hardening and distribution

**Duration:** 3–4 weeks

Deliver:

- Signed installers
- Start-on-login
- Mobile store builds
- Update mechanism
- Sanitized diagnostics
- Privacy/security docs
- Support runbooks
- Compatibility matrix automation

The v1 release contains Codex and OpenCode only. Claude, dedicated voice, and optional relay/push remain post-v1 work unless separately approved.

### Phase 10 — Post-v1 Claude managed adapter beta

**Duration:** 3–4 weeks

Deliver:

- Agent SDK query/session integration
- Session ID/cwd persistence
- Resume/fork
- Partial output
- Permission/user-input callbacks
- Skills/hooks setting-source policy
- Reconciliation and limitations UI

Exit criteria:

- Beta adapter contract suite passes
- Removed/deprecated SDK APIs are not used

This phase is not part of the v1 release and must not block v1 readiness, packaging, or launch.

### Phase 11 — Post-v1 dedicated voice beta

**Duration:** 2–3 weeks

Deliver:

- Push-to-talk beta
- Optional on-device/host transcription proof paths
- Voice failure recovery
- Latency instrumentation

Exit criteria:

- Voice latency targets met
- Full text-only parity remains available

### Phase 12 — Post-v1 optional relay and push

**Duration:** 3–5 weeks

Deliver:

- Content-blind relay
- Outbound bridge/client tunnels
- E2E frame encryption
- Presence and routing grants
- Generic APNs/FCM push
- Rate limiting
- Self-hosted deployment

Exit criteria:

- Core local operation unaffected by relay outage
- Relay cannot decrypt captured content
- External security review complete

## 5. MVP scope

MVP includes:

- Local bridge
- Direct same-network connection
- QR pairing
- Fake adapter
- Codex adapter
- OpenCode adapter
- Session board
- Attention queue
- Text steering
- Structured approvals
- Reconnect/replay/snapshot
- Device revocation

V1/MVP excludes:

- Managed relay
- Product account
- Guaranteed background push
- Claude support, including beta support
- Voice
- Arbitrary terminal/file browser

## 6. Quality gates per phase

Each phase requires:

- Unit tests
- Contract/integration tests where applicable
- Documentation update
- Threat-model delta
- Accessibility review for UI changes
- Migration review for database changes
- Compatibility fixture update for adapters

## 7. Estimated schedule

- Codex/OpenCode local MVP: 10–14 weeks with two engineers
- Local/private-network beta with accessibility and optional voice beta: 14–18 weeks
- V1 release hardening and distribution for Codex/OpenCode: 16–22 weeks
- Post-v1 Claude beta and optional relay: scheduled separately after v1
- Single experienced engineer: approximately 30–40 weeks

## 8. First eight sprints

### Sprint 1

- Monorepo
- UCP schemas
- SQLite migration
- Fake adapter skeleton
- Bridge health endpoint/CLI

### Sprint 2

- UCP WebSocket
- Event journal
- Command idempotency
- Fake streaming/approval scenarios

### Sprint 3

- Mobile navigation/state store
- Session board
- Attention queue
- Direct development connection

### Sprint 4

- Replay/snapshot
- Approval UI/concurrency
- Mobile cache/offline mode

### Sprint 5

- Codex process/handshake/schema generation
- Thread/session mapping

### Sprint 6

- Codex streaming/approvals/cancel/reconcile
- Codex integration tests

### Sprint 7

- OpenCode lifecycle/auth/SSE/session mapping

### Sprint 8

- OpenCode permissions/diff/reconcile
- Cross-runtime UI capability testing

## 9. Definition of done for v1

V1 runtime scope is exactly Codex and OpenCode. No other runtime adapter is a release dependency or launch requirement.

- Install bridge on macOS, Windows, Linux
- Pair Android/iOS without account
- Detect Codex/OpenCode
- View sessions and attention items
- Send/steer/cancel where supported
- Answer approvals/questions
- Recover after phone/bridge/runtime disconnects
- Revoke device
- Complete core flow with VoiceOver/TalkBack
- No runtime credentials on phone
- No public inbound host port required
- Claude adapter is not included in the v1 release gate

Current QA-readiness delta:

- The repository is beyond initial implementation and has a green test and typecheck baseline.
- V1 is not yet QA-ready until the outstanding Phase 5 to 7 release-gate items and Phase 8 to 9 validation evidence are closed.
