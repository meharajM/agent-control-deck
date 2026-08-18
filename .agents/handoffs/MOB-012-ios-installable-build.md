# Handoff: MOB-012 Installable iOS Development Build

## Summary

Added a canonical iOS wrapper that sets CocoaPods to UTF-8 and fails early when Swift tools 6.2 or the selected Xcode license is unavailable. After the host upgrade, Xcode 26.6 and the iOS 26.5 simulator runtime produced a successful installable development build.

## Files changed

- `.agents/active/MOB-012-ios-installable-build.md`
- `apps/mobile/scripts/run-ios.sh`
- `apps/mobile/package.json`
- `docs/development/DEVELOPMENT_ENVIRONMENT.md`
- `RUNNING.md`
- `setup.md`

## Contracts used or changed

- Expo SDK 56 native build workflow
- Existing iOS project and Podfile
- Existing compatibility and development-environment docs
- No protocol, bridge, pairing, crypto, or runtime contracts changed

## Tests run

- `pnpm --filter @agent-deck/mobile typecheck` — pass
- `pnpm --filter @agent-deck/mobile test` — 8 files, 61 tests pass
- `pnpm typecheck` — 13 packages pass
- `pnpm --filter @agent-deck/bridge test` — 5 files, 40 tests pass
- `sh -n apps/mobile/scripts/run-ios.sh` — pass
- `git diff --check` — pass
- `DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer pnpm --filter @agent-deck/mobile ios --device "AgentDeck iPhone 16 (iOS 26.5)"` — build succeeded, installed `com.agentdeck.mobile`, launched Metro, and opened the app
- `xcrun simctl get_app_container 2FD23D1B-514F-4947-90B1-765B619E271B com.agentdeck.mobile app` — installed app container returned
- `xcrun simctl launch 2FD23D1B-514F-4947-90B1-765B619E271B com.agentdeck.mobile` — launch returned process ID `76063`
- `xcrun simctl io 2FD23D1B-514F-4947-90B1-765B619E271B screenshot /tmp/agentdeck-ios26-running.png` — screenshot captured with the Agent Deck pairing screen visible

## Tests not run

- Physical-device install — requires a supported Xcode and Apple signing/team
- Maestro iOS flow — requires a successfully installed app

## Known limitations

- The selected Xcode is `/Applications/Xcode-26.6.0.app`; keep it selected for iOS development builds.
- This host has both iOS 18.6 and iOS 26.5 simulator runtimes. The verified device is `AgentDeck iPhone 16 (iOS 26.5)`.
- Xcode 26.6's iOS SDK build is `23F81a` while the installed iOS 26.5 runtime is `23F73`; the local CoreSimulator runtime-match override maps the SDK to that installed runtime.
- Do not pin or fork `expo-modules-jsi` to bypass Swift 6.2 without a reviewed compatibility change; stable Expo SDK 56 releases tested here all declare Swift tools 6.2.

## Security/privacy impact

None. No secrets, credentials, pairing data, or runtime payloads touched.

## Accessibility impact

None. No app interaction changed.

## Follow-up tasks

1. Run the Maestro iOS flow against the installed simulator build.
2. Validate physical-device signing/install with a configured Apple development team.
3. Keep the iOS 26.5 simulator runtime-match override if Xcode reports that no matching runtime is installed.

## Suggested reviewer

Mobile/release owner and QA.
