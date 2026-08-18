# Technology Stack and Blocker Audit

## 1. Audit result

The architecture is implementable with mainstream, maintained tooling. After the changes in this audit, there are no known critical architecture blockers for building, testing, packaging, or using the local-first product.

There are unavoidable external prerequisites—particularly macOS/Xcode for iOS builds, Codex/OpenCode authentication, and a server for background push notifications—but none prevents the local-first MVP.

## 2. Locked baseline stack

### Mobile

- Expo SDK 56 stable line
- React Native 0.85
- React 19.2
- TypeScript strict mode
- Expo development builds and Continuous Native Generation
- Expo Router
- Zustand plus reducer-style normalized event application
- `expo-sqlite` for non-secret cache
- `expo-secure-store` for small device credentials
- `expo-local-authentication` for biometric gates
- `react-native-zeroconf` for Bonjour/mDNS host discovery
- Native `WebSocket` for foreground communication
- Maestro for mobile E2E testing
- React Native Testing Library for component tests

### Host bridge

- Node.js 24 LTS
- TypeScript in ESM mode
- Fastify 5 for localhost health/admin endpoints
- `ws` for UCP WebSocket service
- `better-sqlite3` 12.x in WAL mode
- Zod for runtime validation
- Ajv for JSON Schema conformance
- Pino for redacted structured logs
- Vitest for unit, contract, and integration tests
- `child_process` first, worker/child isolation after MVP

### Workspace and CI

- pnpm workspaces
- Hoisted node linker initially for maximum React Native/native-module compatibility
- Turborepo for task orchestration only
- GitHub Actions as the default CI
- EAS Build optional, not required
- macOS CI for iOS compile and simulator flows
- Linux CI for protocol, bridge, schemas, and Android unit work
- Windows CI for bridge runtime and installer smoke tests

## 3. Changes made to remove implementation blockers

### 3.1 Local TLS/WebSocket blocker

#### Problem

A bridge-generated self-signed certificate is not automatically trusted by iOS or Android. Standard React Native WebSocket APIs do not provide a simple, portable certificate-pinning hook. Requiring a custom TLS module in the first mobile slice would slow development and create native maintenance risk.

#### Final decision

For direct LAN/private routes:

- Use `ws://` only on explicitly configured local/private endpoints.
- Authenticate the paired host and device at the application layer.
- Encrypt every UCP frame after handshake using reviewed authenticated encryption.
- Reject every unencrypted UCP application frame.
- Configure iOS local-network permission and ATS local-network exception.
- Configure Android cleartext transport only for this application path; UCP content remains encrypted.

For relay or public endpoints:

- Use normal publicly trusted `wss://`.
- Keep UCP end-to-end frame encryption in addition to TLS.

This gives one security model across direct and relayed routes while avoiding a self-signed TLS dependency.

### 3.2 Discovery blocker

#### Problem

mDNS packages may lag React Native New Architecture support and require iOS Bonjour declarations.

#### Final decision

- Four-digit pairing with Bonjour/mDNS host discovery is the primary path; manual endpoint entry remains a development fallback.
- Manual endpoint entry is the fallback.
- Previously successful endpoints are cached.
- mDNS is optional after the first usable release.
- No feature depends on multicast discovery.

### 3.3 Bridge binary packaging blocker

#### Problem

Node Single Executable Applications remain an active-development feature and do not provide the most predictable cross-platform path, especially with native dependencies and all target architectures.

#### Final decision

- Do not use Node SEA for v1 distribution.
- Build platform-specific installers that bundle an official Node 24 runtime, compiled JavaScript, migration files, and target-specific native dependencies.
- Keep `better-sqlite3` external to the JS bundle and copy its prebuilt binary into the installer.
- Build packages on their target OS in CI.
- Run the bridge in the signed-in user session, not as a privileged system service.

### 3.4 Mobile E2E blocker

#### Problem

Detox's documented compatibility may lag the React Native version used by Expo SDK 56, and Expo integration is community-maintained.

#### Final decision

- Maestro is the default mobile E2E framework.
- Maestro tests the final native binary through the accessibility layer and does not add an in-app test dependency.
- Keep a small native unit-test layer only when a custom native module is added.
- Do not introduce Detox unless its supported matrix catches up and it solves a proven gap.

### 3.5 Background push without server

#### Problem

APNs and FCM event delivery requires a push provider/server path. A purely local app cannot promise reliable event-driven background alerts while suspended.

#### Final decision

- No-server mode reconnects when opened or foregrounded.
- Foreground in-app attention works normally.
- Guaranteed remote background push belongs only to the optional relay/push service.
- Product copy must not imply background alerts in LAN-only mode.

### 3.6 Voice implementation blocker

#### Problem

Cross-platform continuous speech recognition and host audio streaming introduce native dependencies, privacy work, model distribution, and latency testing before core reliability is proven.

#### Final decision

- V1 includes text input and works with the operating system keyboard's dictation feature.
- Dedicated push-to-talk is beta after session, approval, and reconnection flows are stable.
- The first dedicated implementation records audio locally and requires explicit send.
- Host transcription and embedded models are optional modules, not prerequisites.

### 3.7 Post-v1 Claude session durability limitations

#### Problem

A pending in-process SDK permission callback cannot be assumed to survive an unexpected bridge process termination.

#### Final decision

- Claude is deferred from v1 and remains a post-v1 beta target.
- Use the current TypeScript `query()` API, streaming input, `Query.interrupt()`, `canUseTool`, session IDs, `resume`, and `fork_session`.
- Use documented TypeScript defer behavior where applicable.
- If an in-flight callback cannot be recovered after restart, mark the approval interrupted and reconcile/resume the session; never infer approval.
- Do not claim arbitrary existing CLI attachment parity.

### 3.8 Native SQLite installation risk

#### Problem

`better-sqlite3` is a native dependency and can require a compiler when a matching prebuild is unavailable.

#### Final decision

- Pin Node 24 LTS and a tested `better-sqlite3` release with Node 24 prebuilds.
- CI installs dependencies on macOS arm64/x64 where needed, Windows x64, Linux x64, and Linux arm64 when supported.
- Production installers contain the already-built artifact; end users do not run `npm install`.
- Keep a database interface boundary so `node:sqlite` can replace it after the built-in module reaches stable status.

### 3.9 Monorepo/native module resolution risk

#### Problem

React Native monorepos can fail when native modules or React are duplicated.

#### Final decision

- Use pnpm with hoisted linking at bootstrap.
- Require every workspace to declare direct dependencies.
- Enforce one React, React Native, and Expo version with root overrides.
- Run `pnpm why react react-native expo` in CI.
- Do not manually customize Metro's old monorepo watch/resolver fields.

## 4. Package selection policy

### Required at bootstrap

- `expo`
- `react`
- `react-native`
- `expo-router`
- `expo-sqlite`
- `expo-secure-store`
- `expo-local-authentication`
- `expo-camera`
- `expo-network`
- `zustand`
- `zod`
- `fastify`
- `ws`
- `better-sqlite3`
- `ajv`
- `pino`
- `vitest`
- `typescript`

### Add only after a feature needs it

- Remote notifications
- Audio recording/transcription packages
- mDNS/Bonjour mobile module
- Tauri/Electron tray UI
- OpenTelemetry exporters
- SQL ORM/query builder
- Relay data-store clients
- Binary serialization

### Explicitly avoided in the first slice

- Node SEA
- Custom certificate-pinning WebSocket module
- Detox
- Redis
- PostgreSQL
- Kafka/NATS
- Kubernetes
- Electron bridge shell
- A mobile terminal emulator
- A general-purpose file browser

## 5. Runtime prerequisites

### Codex

- User installs and authenticates Codex separately.
- Bridge runs or connects to `codex app-server`.
- Integration tests require an explicitly configured maintainer environment.

### OpenCode

- User installs and configures OpenCode separately.
- Bridge starts `opencode serve` on loopback with a generated password or connects to an existing configured server.

### Claude (post-v1)

- The Agent SDK package bundles a platform-native Claude Code binary as an optional dependency where available.
- Installer builds must preserve optional platform packages.
- `pathToClaudeCodeExecutable` is the fallback when the bundled executable is absent.
- Provider/API authentication stays on the host.

## 6. Platform constraints

### iOS

- Local device/simulator builds require macOS and Xcode.
- TestFlight/App Store distribution requires Apple signing credentials.
- Local network access requires a usage description.
- Bonjour discovery requires declared service types if enabled.
- Real biometric behavior must be tested on a physical device.

### Android

- Android Studio/JDK are required for local native builds.
- Network security config must permit the local WebSocket path.
- Real biometric and background behavior requires physical-device coverage.

### Host

- macOS: LaunchAgent in user session.
- Windows: startup task/user-session launcher; avoid LocalSystem service for runtime access.
- Linux: systemd user service where available, foreground CLI fallback everywhere.

## 7. No-blocker implementation order

1. Protocol package with JSON fixtures.
2. Fake adapter and bridge in loopback development mode.
3. Mobile app against fake bridge using local application-encrypted WebSocket.
4. SQLite journal and idempotency.
5. QR/manual endpoint pairing.
6. Codex adapter.
7. OpenCode adapter.
8. Physical-device LAN tests.
9. Installer packaging.
10. Private-network endpoints.
11. V1 release hardening and distribution for Codex/OpenCode.
12. Post-v1 Claude beta.
13. Post-v1 dedicated voice.
14. Post-v1 optional relay and push.

## 8. Go/no-go proof spikes

Complete these before feature development branches widely:

### Spike A — mobile transport

- Android and iOS connect to a LAN `ws://` endpoint.
- UCP encrypted handshake completes.
- Local-network permissions behave correctly.
- Reconnection works after Wi-Fi toggle.

### Spike B — bridge packaging

- Package one signed or development installer per OS.
- Bundled Node starts without system Node.
- `better-sqlite3` loads.
- User-session auto-start works.

### Spike C — runtime adapters

- Codex thread start, stream, and one approval.
- OpenCode session stream and one permission answer.

The Claude `query()` stream, interrupt, and `canUseTool` proof is post-v1 and is not a v1 gate.

### Spike D — E2E

- Maestro runs the same pairing/session/approval flow on Android emulator and iOS simulator.

No full feature phase begins until its associated spike passes.

## 9. Final readiness statement

The chosen stack is suitable for implementation. The plan no longer depends on experimental Node packaging, unsupported mobile TLS pinning, automatic mDNS discovery, Detox compatibility, a managed server, or dedicated speech recognition to reach the first usable release.
