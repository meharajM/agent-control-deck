# Source Notes

Checked July 2026. Prefer official documentation and regenerate/check runtime schemas during implementation.

## Codex

- Codex app-server README in the official OpenAI Codex repository
- OpenAI article: Unlocking the Codex harness: how we built the App Server
- Key implementation facts: JSON-RPC-style app-server; stdio default; Unix socket supported; TCP WebSocket experimental; generated TypeScript/JSON schemas are version specific; structured approvals and threads/turns/items.

## OpenCode

- OpenCode Server documentation
- Key implementation facts: `opencode serve`; loopback default; HTTP basic authentication through environment variables; OpenAPI 3.1; health/version; session APIs; permission response; diff; SSE global events.
- Verified on July 22, 2026: the bridge live probe succeeds against local OpenCode `1.17.18` after the bridge server-manager ESM import fix.

## Claude Code

- Claude Agent SDK overview
- Work with sessions
- Configure permissions
- Streaming input/output
- Use Claude Code features in the SDK
- Key implementation facts: Agent SDK runs locally in the integrator process; current TypeScript implementation should use `query()` and documented resume/fork/session utilities; the experimental V2 `createSession()` API was removed; session history persists locally and is distinct from filesystem state.

## MCP

- MCP specification 2025-11-25
- Streamable HTTP transport
- MCP Tasks extension overview
- Key implementation facts: standard transports are stdio and Streamable HTTP; Origin validation/authentication/local binding guidance applies; Tasks provide durable handles and input-required states but extension support varies.

## Networking/security

- Tailscale device connectivity documentation
- OWASP MASVS
- Apple Keychain/LocalAuthentication guidance
- Android Keystore/BiometricPrompt guidance

## Maintenance rule

Every runtime adapter release records:

- Documentation/schema date
- Runtime version tested
- Adapter version
- Experimental features used
- Known unsupported events/decisions

## Mobile/toolchain

- Expo SDK 56 release and monorepo documentation
- Expo development-build, SecureStore, SQLite, and custom-native-code documentation
- Apple local-network privacy and App Transport Security local-network exception documentation
- Android Network Security Configuration documentation
- Key implementation facts: development builds support custom native code; Expo SDK 56 is a stable React Native 0.85 baseline; pnpm monorepos are supported; local-network permission/configuration is required; secure storage is intended for small values.
- Verified on July 22, 2026: Android local emulator builds require JDK 17 instead of Java 11 for the current Expo SDK 56 and React Native 0.85 toolchain. The repository wrapper `apps/mobile/scripts/run-android-simulator.sh` now provides a validated Android path by reusing or booting `ContextEngine_Test_Device`, waiting for the specific emulator serial to complete boot, and then invoking Expo; direct `expo run:android` remains less reliable when Expo must launch the emulator itself. iOS simulator builds are currently blocked on Xcode 16.4 because the resolved Swift package graph requires Swift tools `6.2.0` while Xcode 16.4 provides Swift `6.1.x`.

## Node/bridge packaging

- Node.js release schedule
- Node Single Executable Applications documentation
- better-sqlite3 official repository/releases
- Key implementation facts: Node 24 is LTS; Node SEA remains active-development with platform limitations; better-sqlite3 publishes LTS prebuilds, so target-specific installer builds are the lower-risk distribution path.

## Mobile testing

- Maestro React Native/platform documentation
- Detox compatibility/environment documentation
- Key implementation facts: Maestro supports React Native/Expo without in-app instrumentation; Detox's documented React Native compatibility can lag the selected Expo React Native version.
