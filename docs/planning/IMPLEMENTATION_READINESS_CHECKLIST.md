# Implementation Readiness Checklist

## Architecture

- [ ] UCP v1 envelope and commands accepted
- [ ] App-layer direct-route encryption spike passes
- [ ] Snapshot/replay semantics accepted
- [ ] Approval first-writer-wins semantics accepted
- [ ] Relay explicitly excluded from MVP critical path

## Mobile

- [ ] Expo SDK 56 project builds on iOS and Android
- [ ] Local network permission text approved
- [ ] Android network security config generated
- [ ] QR camera flow works on physical devices
- [ ] SecureStore key-size/error handling tested
- [ ] Expo SQLite migrations tested
- [ ] Maestro flow runs on both simulators

## Bridge

- [ ] Node 24 LTS pinned
- [ ] `better-sqlite3` loads on all release targets
- [ ] Installer bundles Node and does not require system Node
- [ ] User-session auto-start strategy works per OS
- [ ] `agent-deck doctor` reports runtime prerequisites

## Runtime adapters

- [ ] Codex app-server proof spike passes
- [ ] OpenCode HTTP/SSE proof spike passes
- [ ] Claude `query()`/interrupt/approval proof spike passes
- [ ] Runtime compatibility mode exists
- [ ] Unknown approvals fail closed

## Testing

- [ ] Fake adapter covers all attention and failure states
- [ ] Replay equals snapshot property test passes
- [ ] Duplicate command test passes
- [ ] Two-device approval race test passes
- [ ] Bridge restart test passes
- [ ] No-internet local-only test passes

## Security

- [ ] Pairing QR is single-use and expiring
- [ ] Device revocation closes active connection
- [ ] UCP frames reject replay/tampering
- [ ] Push payload contains no private detail
- [ ] Logs redact prompts, secrets, commands, and paths
- [ ] Crypto protocol scheduled for independent review

## External prerequisites documented

- [ ] macOS/Xcode needed for iOS local builds
- [ ] Apple developer membership needed for distribution
- [ ] Runtime installation/authentication needed on host
- [ ] Background push needs optional server
- [ ] Dedicated voice is post-MVP/beta
