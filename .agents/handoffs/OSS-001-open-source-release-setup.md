# Handoff: OSS-001 Open-source release and one-time host setup

## What changed

- Added `setup.sh` and `scripts/agent-deck-host.sh` for one-time dependency/build setup, host-only configuration, OpenCode loopback startup, bridge startup, and macOS/Linux sign-in launch.
- Added persistent OpenCode server attachment, authenticated client setup, session discovery, stable runtime session IDs, and polling for sessions created outside the phone.
- Added open-source repository metadata: Apache-2.0 license, security policy, code of conduct, changelog, issue templates, pull request template, contributor guidance, user guide, and release documentation.
- Added CI and version-tag workflows for quality checks plus Android debug and iOS simulator release artifacts.
- Bumped the preview version to `0.1.0-preview.1` and added the release tag after this handoff commit.

## Files changed

See commit `cc673d0` and the follow-up handoff commit for the complete file list. The primary implementation paths are:

- `setup.sh`
- `scripts/agent-deck-host.sh`
- `packages/adapter-opencode/src/{auth.ts,server-manager.ts,opencode-adapter.ts}`
- `apps/bridge/src/adapter-manager.ts`
- `.github/workflows/{ci.yml,release.yml}`
- `README.md`, `docs/product/USER_GUIDE.md`, `SECURITY.md`, `CONTRIBUTING.md`

## Contracts and security

- Consumes the existing RuntimeAdapter, AdapterEvent, OpenCode `/global/health`, `/api/session`, and `/api/event` contracts.
- OpenCode remains bound to loopback; only the Agent Deck bridge is exposed on the selected private interface.
- OpenCode credentials are generated/stored in `~/.config/agent-deck/host.env` with mode `600` and are never sent to the phone or committed.
- `BRIDGE_DEV_MODE` remains limited to local simulator development documentation.

## Validation evidence

- `bash -n setup.sh scripts/agent-deck-host.sh` — passed.
- `git diff --check` — passed.
- `pnpm typecheck` — 13/13 packages passed.
- `pnpm build` — 12/12 packages passed.
- `pnpm test` — 25/25 tasks passed; 490 tests passed across workspace test suites.
- OpenCode adapter tests — 73 tests passed.
- Live OpenCode smoke: authenticated persistent server on loopback, bridge snapshot included a session created before bridge startup.
- Android: `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` — passed; APK installed and launched on `ContextEngine_Test_Device`.
- iOS device: Xcode 26.6 Debug build — passed; `com.agentdeck.mobile` installed and launched on connected iPhone `C0C9ED91-1D91-5FAA-9CB0-4963A929B21D`.
- iOS release simulator: generic iOS Simulator Release build and archive — passed; local archive created at `/tmp/agent-deck-ios-simulator-v0.1.0-preview.1.zip`.

## Known limitations

- The public phone app is still a preview build; App Store/Play Store signing and distribution accounts are not configured by this task.
- The tag workflow publishes a debug Android APK and unsigned iOS Simulator app archive, not store-ready signed binaries.
- The one-time host setup must be run from a checkout and requires a user-installed/authenticated OpenCode or Codex runtime.
- Existing platform compiler warnings from Expo/React Native dependencies remain non-fatal.
- A local Android multi-ABI build initially hit a full-disk condition; the validated emulator build uses arm64-v8a. GitHub release runners use the default Gradle ABI set.

## Accessibility

No mobile UI behavior was changed. The new setup and user documentation preserves text/manual pairing and does not require voice or gesture-only interaction.

## Follow-up

- Run the tag workflow after push and confirm both release assets upload.
- Perform an independent security review before calling the project production-ready.
- Add signed store pipelines and bundled host installers in a later release task.

## Reviewer

Coordinator / release maintainer; suggested secondary reviewers are bridge/security and mobile/release owners.

## Branch and commit

- Branch: `main` (explicitly requested by the user for this release integration).
- Primary commit: `cc673d0`.
- Handoff was created in commit `c843f63`; the final release tag includes the follow-up handoff metadata update.
