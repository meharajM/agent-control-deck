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

| Runtime | Release status | Required interface | Fallback |
|---|---|---|---|
| Codex | GA target | `codex app-server` stdio | Disable adapter with actionable doctor output |
| OpenCode | GA target | loopback `opencode serve`, OpenAPI/SSE | Connect to explicit existing local server |
| Claude | Beta | TypeScript Agent SDK `query()` | `pathToClaudeCodeExecutable`; disable unsupported capability |

## 3. Capability policy

A runtime version newer than the maximum tested version may connect in compatibility mode, but:

- remote approvals default disabled if payload shape is unknown
- experimental features remain disabled
- user sees a compatibility warning
- diagnostics include detected version

## 4. OS test matrix

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
