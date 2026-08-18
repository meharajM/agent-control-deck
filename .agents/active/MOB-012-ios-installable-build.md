# Task: MOB-012 Installable iOS Development Build

## Owner role

Mobile application and release validation.

## Goal

Provide a reproducible iOS development-build command that installs Agent Deck on a local iOS simulator or connected development device.

## Background

The Expo SDK 56 native graph requires Swift tools 6.2. The current host also needs an explicit UTF-8 locale for Homebrew CocoaPods under Ruby 4. The repository must surface both prerequisites clearly and keep the canonical command usable after the host toolchain is corrected.

## Dependencies

- Existing Expo SDK 56 native project under `apps/mobile/ios`
- Existing mobile app and bridge implementation
- Xcode 26.0 or newer with Swift tools 6.2 on macOS 15.6 or newer

## Contracts consumed

- `docs/development/DEVELOPMENT_ENVIRONMENT.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`
- `docs/development/TESTING_STRATEGY.md`
- Expo SDK 56 native build workflow

## Allowed paths

- `apps/mobile/**`
- `.agents/active/MOB-012-ios-installable-build.md`
- `.agents/handoffs/MOB-012-ios-installable-build.md`
- `docs/development/DEVELOPMENT_ENVIRONMENT.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`
- `RUNNING.md`
- `setup.md`

## Forbidden paths

- Runtime adapters
- Bridge protocol, persistence, pairing, or crypto contracts
- Dependency source forks
- Database migrations

## Acceptance criteria

- [ ] Canonical iOS command sets UTF-8 locale before CocoaPods runs.
- [ ] Canonical iOS command fails early with an actionable Xcode/Swift tools requirement.
- [x] iOS simulator build installs and launches on a supported Xcode host.
- [x] Mobile typecheck and tests pass.
- [x] Install/test steps document simulator and physical-device signing limits.

## Required tests

- Mobile typecheck
- Mobile unit tests
- iOS simulator development build/install
- `git diff --check`

## Security/privacy considerations

No credentials, runtime secrets, or pairing behavior changes. Physical-device builds use normal Apple signing.

## Accessibility considerations

No user-facing interaction changes. Existing VoiceOver/TalkBack semantics remain in scope for the app build.

## Handoff recipient

Coordinator, mobile, and QA reviewers.
