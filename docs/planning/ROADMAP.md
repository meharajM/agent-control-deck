# Roadmap

## Milestone 1 — Local vertical slice

- Fake adapter
- Bridge core
- Session board
- Approval queue
- Replay/snapshot

Status: implemented in-repo.

## Milestone 2 — Codex and OpenCode v1 foundation

- Production adapters
- Direct LAN pairing
- Device revocation
- Shared capabilities across Codex and OpenCode

Status: mostly implemented in-repo; security and networking integration and validation remain open.

## Milestone 3 — Codex/OpenCode v1 hardening and release

- Tailscale/manual private endpoint
- Route selection
- Reliability hardening
- Accessibility completion
- Signed bridge and mobile release artifacts
- No-internet local-first release validation

Status: in progress. Current QA-readiness blockers are concentrated here.

## Milestone 4 — Post-v1 Claude managed beta

- Agent SDK sessions
- Resume/fork
- Approvals/questions
- Skills/hooks policy

This milestone is not part of v1 and does not block the Codex/OpenCode release.

Status: adapter package exists, but this milestone remains outside the v1 QA gate.

## Milestone 5 — Post-v1 voice

- Push-to-talk
- On-device transcription
- Optional host transcription
- Latency instrumentation

Status: deferred. Text input and OS dictation remain the supported v1 path.

## Milestone 6 — Post-v1 optional relay

- E2E encrypted routing
- Generic push
- Self-hosted option
- Security review

Status: deferred. Relay is not part of current QA readiness.

## Later possibilities

- MCP server exposing sessions/tools/tasks
- Read-only paired device role
- Tablet two-pane layout
- Organization policy packs
- Community runtime adapters
- MCP App dashboard
- Wearable notification triage after approval safety validation

## Explicitly deferred

- Full terminal
- Code editor
- Remote desktop
- Cloud agent execution
- Automatic high-risk approvals
