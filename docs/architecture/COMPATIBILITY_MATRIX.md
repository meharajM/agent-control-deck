# Compatibility Matrix

## 1. Product baseline

| Layer | Baseline | Policy |
|---|---|---|
| Node | 24 LTS | Only supported LTS releases; 24 is release baseline |
| Expo | SDK 56 | Upgrade through dedicated compatibility project |
| React Native | 0.85 | Inherited from Expo SDK 56 |
| React | 19.2 | Inherited from Expo SDK 56 |
| Android | Android 7+ product baseline unless store policy requires higher | Test current and minimum supported |
| iOS | iOS 16.4+ baseline for SDK 56 | Test current and minimum supported |
| SQLite bridge | better-sqlite3 12.x | Pin exact tested version |
| Mobile SQLite | Expo-compatible expo-sqlite | Install with `expo install` |

## 2. Runtime adapter status

V1 supports exactly Codex and OpenCode. Other adapters may be developed independently after the v1 release, but cannot be required to build, test, package, or launch v1.

| Runtime | Release status | Required interface | Fallback |
|---|---|---|---|
| Codex | V1 required | `codex app-server` stdio | Disable adapter with actionable doctor output |
| OpenCode | V1 required | loopback `opencode serve`, OpenAPI/SSE | Connect to explicit existing local server |
| Claude | Post-v1 | TypeScript Agent SDK `query()` | Evaluate separately after v1; disable unsupported capability |

## 3. Capability policy

A runtime version newer than the maximum tested version may connect in compatibility mode, but:

- remote approvals default disabled if payload shape is unknown
- experimental features remain disabled
- user sees a compatibility warning
- diagnostics include detected version

## 4. OS test matrix

Current verified host constraints on August 18, 2026:

- Android local emulator builds require JDK 17 for the current Expo SDK 56 and React Native 0.85 toolchain; Java 11 is insufficient.
- Local Android validation is reliable on this host through `apps/mobile/scripts/run-android-simulator.sh`, which reuses or boots `ContextEngine_Test_Device` under JDK 17, waits for the specific emulator to complete boot, and then invokes Expo with Metro startup enabled. Plain `expo run:android` remains less reliable when Expo is responsible for launching the emulator itself.
- Local iOS simulator validation passes with Xcode 26.6, the iOS 26.5 simulator runtime, and the repository's documented runtime-match override for the installed SDK/runtime build pair.

### Every release

- Current macOS arm64
- Current Windows x64
- Current Ubuntu LTS x64
- Current iOS simulator
- Minimum-supported iOS simulator where CI supports it
- Current Android emulator
- Minimum-supported Android API emulator

### Periodic

- macOS x64
- Linux arm64
- Physical iPhone
- Physical Android
- Tailscale direct and relayed paths

## 5. Unsupported baseline

- iOS builds from Windows/Linux without a remote macOS build environment
- background APNs/FCM alerts without optional server infrastructure
- arbitrary existing Claude CLI attachment as a GA feature
- public unauthenticated bridge endpoints
- OpenClaw
