# Implementation Readiness Checklist

Validated doc and status sync date: 2026-07-22

Use this checklist as a release-gate tracker, not as a historical implementation log. Checked items have current evidence in code, status files, or handoffs. Unchecked items remain open even if partial implementation exists.

## Architecture

- [x] UCP v1 envelope and commands accepted
- [x] App-layer direct-route encryption spike passes
- [x] Snapshot/replay semantics accepted
- [x] Approval first-writer-wins semantics accepted
- [x] Relay explicitly excluded from MVP critical path

## Mobile

- [ ] Expo SDK 56 project builds on iOS and Android
- [ ] Local network permission text approved
- [ ] Android network security config generated
- [x] Four-digit pairing UI works in the cross-platform mobile build
- [ ] SecureStore key-size/error handling tested
- [ ] Expo SQLite migrations tested
- [ ] Maestro flow runs on both simulators

Current gap summary:

- Mobile supervision, pairing UI, and route-selection code exist, but physical-device build and Maestro evidence are not yet recorded here.

## Bridge

- [x] Node 24 LTS pinned
- [x] Root launch commands select `fake`, `codex`, or `opencode` with `BRIDGE_RUNTIME`
- [ ] `better-sqlite3` loads on all release targets
- [ ] Installer bundles Node and does not require system Node
- [ ] User-session auto-start strategy works per OS
- [ ] `agent-deck doctor` reports runtime prerequisites

Current gap summary:

- Bridge core, UCP gateway, and persistence are implemented.
- Root launch commands now make the single-runtime selection reproducible for local runs.
- Packaging, installer, and operator-facing validation remain open.

## Runtime adapters

- [ ] Codex app-server proof spike passes
- [x] OpenCode HTTP/SSE proof spike passes against local OpenCode `1.17.18`; bridge live smoke covers start and follow-up instruction dispatch
- [x] Codex and OpenCode are the only runtime adapters required by v1
- [x] Claude `query()`/interrupt/approval proof spike is explicitly deferred post-v1
- [ ] Runtime compatibility mode exists
- [ ] Unknown approvals fail closed

Current gap summary:

- Codex and OpenCode adapter packages are present and currently part of the green workspace baseline.
- Compatibility-mode and release-evidence items remain open until explicitly documented here.

## Testing

- [x] Fake adapter covers all attention and failure states
- [x] Replay equals snapshot property test passes
- [x] Duplicate command test passes
- [x] Two-device approval race test passes
- [x] Bridge restart test passes
- [ ] No-internet local-only test passes

Current gap summary:

- The repository baseline is a green `pnpm test` and `pnpm typecheck`.
- Offline and no-internet release validation are still open QA gates.

## Security

- [x] Pairing code is single-use and expiring
- [ ] Device revocation closes active connection
- [x] UCP frames reject replay/tampering
- [ ] Push payload contains no private detail
- [ ] Logs redact prompts, secrets, commands, and paths
- [x] Crypto protocol scheduled for independent review

Current gap summary:

- Pairing and frame encryption foundations are implemented.
- Durable device and nonce persistence, active-connection revocation confirmation, and end-to-end log and push validation remain open.

## External prerequisites documented

- [x] macOS/Xcode needed for iOS local builds
- [x] Apple developer membership needed for distribution
- [x] Runtime installation/authentication needed on host
- [x] Background push needs optional server
- [x] Dedicated voice is post-MVP/beta
- [x] Claude support is post-v1 and is not a release prerequisite
