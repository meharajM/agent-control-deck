# Development Environment

## 1. Supported developer hosts

### Full mobile and bridge development

- macOS 14 or newer recommended
- Xcode with a Swift Package Manager toolchain that supports Swift tools `6.2`
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
DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer pnpm --filter @agent-deck/mobile ios --device "AgentDeck iPhone 16 (iOS 26.5)"
pnpm --filter @agent-deck/mobile android
```

On this host, `pnpm --filter @agent-deck/mobile android` is the deterministic Android simulator path instead of relying on Expo to boot an AVD itself:

```bash
cd apps/mobile
./scripts/run-android-simulator.sh
```

The wrapper:

- uses JDK 17 from `/opt/homebrew/opt/openjdk@17/...` when `JAVA_HOME` is unset;
- uses `ANDROID_SDK_ROOT` or `~/Library/Android/sdk` to locate `adb` and `emulator` when they are not already on `PATH`;
- reuses an already-booted emulator for the target AVD when one exists;
- otherwise starts `ContextEngine_Test_Device`, waits for that specific emulator serial to appear, waits for `sys.boot_completed=1`, then runs `expo run:android --device <avd-name> --no-bundler`;
- unsets an invalid inherited `LC_ALL` value so the wrapper does not emit a host-locale warning before the Android build starts.
- lets Expo start Metro as part of the same command, so the installed debug build can immediately load its JavaScript bundle instead of landing on the red-screen "Unable to load script" error when no bundler is already running.

A native rebuild is needed after adding or changing native modules/config plugins, but ordinary TypeScript changes use the normal Metro fast-refresh workflow. The iOS wrapper sets a UTF-8 locale for CocoaPods and checks for Swift tools 6.2 before starting Expo. Xcode 26.0 or newer on macOS 15.6+ is required by the current Expo SDK 56 dependency graph. If Xcode is not system-selected, set `DEVELOPER_DIR` to its `Contents/Developer` path and accept its license once.

Verified local host results on August 18, 2026:

- Android local builds advanced only after replacing Java 11 with JDK 17.
- The repository wrapper now provides a stable Android install/test path on this host: it booted or reused `ContextEngine_Test_Device`, built the app, installed the debug APK, and opened the Expo development client.
- Direct `expo run:android` remains less reliable when Expo must start the emulator itself, which is why the wrapper boots the emulator first and then hands off bundle startup to Expo.
- The iOS simulator build/install is verified on Xcode 26.6 with Swift `6.3.3` and the iOS 26.5 runtime. The first build compiled ExpoModulesJSI successfully, installed `com.agentdeck.mobile`, launched it, and loaded the Metro bundle.
- If multiple simulator runtimes are installed, target `AgentDeck iPhone 16 (iOS 26.5)` so Expo does not select the older iOS 18.6 `iPhone 16` device.

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
