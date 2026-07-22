# Development Environment

## 1. Supported developer hosts

### Full mobile and bridge development

- macOS 14 or newer recommended
- Xcode version required by Expo SDK 56 and by the resolved Swift package graph
- Android Studio with SDK 36 toolchain
- Node.js 24 LTS
- Corepack-enabled pnpm
- JDK 17 for current Android local builds

A macOS machine is the only environment that can locally build both iOS and Android.

### Android and bridge development

- Windows 11, current Ubuntu LTS, or macOS
- Android Studio
- Node.js 24 LTS
- JDK 17

### Bridge/protocol development only

- Windows, Linux, or macOS
- Node.js 24 LTS
- No mobile SDK required

## 2. Toolchain policy

Pin:

- Node major/minor through `.nvmrc` or Volta/asdf
- pnpm through root `packageManager`
- Expo SDK major
- Xcode/Android images in CI
- Runtime versions in compatibility jobs

Do not use Node Current for normal development. Use Node 24 LTS.

## 3. Mobile workflow

Use Expo development builds rather than Expo Go as the canonical environment.

Commands:

```bash
pnpm install
pnpm --filter @agent-deck/mobile expo prebuild --clean
pnpm --filter @agent-deck/mobile expo run:ios
pnpm --filter @agent-deck/mobile expo run:android
```

On this host, use the deterministic Android simulator wrapper instead of relying on Expo to boot an AVD itself:

```bash
pnpm --filter @agent-deck/mobile run android:simulator
```

The wrapper:

- uses JDK 17 from `/opt/homebrew/opt/openjdk@17/...` when `JAVA_HOME` is unset;
- reuses an already-booted Android emulator when one exists;
- otherwise starts `ContextEngine_Test_Device`, waits for `sys.boot_completed=1`, then runs `expo run:android --device <avd-name> --no-bundler`.

A native rebuild is needed after adding or changing native modules/config plugins, but ordinary TypeScript changes use the normal Metro fast-refresh workflow.

Verified local host results on July 22, 2026:

- Android local builds advanced only after replacing Java 11 with JDK 17.
- The current Android validation blocker on this host is emulator startup reliability: `expo run:android` timed out while starting the `ContextEngine_Test_Device` emulator.
- The current iOS validation blocker on this host is Swift tools compatibility: Xcode 16.4 provides Swift `6.1.x`, but the resolved package graph requires Swift tools `6.2.0`.

## 4. Bridge workflow

```bash
pnpm --filter @agent-deck/bridge dev
pnpm --filter @agent-deck/bridge test
pnpm --filter @agent-deck/bridge doctor
```

Development mode defaults to loopback and the fake adapter.

## 5. Runtime test profiles

Use explicit profiles. V1 real-runtime profiles are Codex and OpenCode; Claude and the combined profile are post-v1.

```text
fake
codex-local
opencode-local
claude-local
all-local
```

Real-runtime tests must use disposable repositories and must not run as part of an untrusted pull request.

## 6. Secrets

Use local environment files excluded from Git.

Never put provider credentials in:

- mobile environment variables
- Expo public configuration
- test fixtures
- CI logs
- relay configuration

## 7. Physical-device requirements

Before marking mobile networking complete, test:

- iPhone on Wi-Fi
- Android phone on Wi-Fi
- local-network permission denied then enabled
- Wi-Fi change
- app background/foreground
- biometric approval
- host sleep/wake

## 8. Contributor fallback

Contributors without runtime accounts or mobile SDKs can implement and test:

- Protocol
- Bridge core
- Fake adapter
- Data model
- Redaction
- State reducers
- Documentation

The fake adapter is the required no-account test path.
