# Task 1 Report - Android simulator recovery

## Outcome

DONE_WITH_CONCERNS

The Android simulator path is reproducible on this host without relying on Expo's emulator auto-start branch.

## Diagnosis

- Repo build and tests were already green before this task.
- The earlier Android failure had two distinct causes on this host:
  - Java 11 instead of Java 17.
  - Expo timing out while trying to boot the Android emulator itself.
- After exporting Java 17, a direct run against the already-running emulator succeeded:
  - `pnpm exec expo run:android --device "ContextEngine_Test_Device" --no-bundler`
- That showed the failure was not in the Android app build itself. The unstable part was Expo's emulator-start path.

## What I changed

### 1. Added a deterministic Android simulator wrapper

File:
- `apps/mobile/scripts/run-android-simulator.sh`

Behavior:
- Uses `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` when `JAVA_HOME` is unset.
- Reuses a booted Android emulator when one already exists.
- Otherwise starts the `ContextEngine_Test_Device` AVD.
- Waits until `adb shell getprop sys.boot_completed` reports `1`.
- Invokes Expo with an explicit device target and `--no-bundler`:
  - `pnpm exec expo run:android --device "$DEVICE_NAME" --no-bundler`

This removes the observed timeout failure mode by avoiding Expo's own emulator boot orchestration.

### 2. Updated development docs

Files:
- `docs/development/DEVELOPMENT_ENVIRONMENT.md`
- `docs/development/BOOTSTRAP_COMMANDS.md`

Change:
- Documented `cd apps/mobile && ./scripts/run-android-simulator.sh` as the deterministic Android simulator path for this host.

## Verification

### Reproduction evidence

Confirmed host state:
- JDK 17 available at `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
- Running emulator detected by `adb devices`
- AVD `ContextEngine_Test_Device` available via `emulator -list-avds`

### Commands run

1. Direct Expo run against the running emulator

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
cd apps/mobile
pnpm exec expo run:android --device "ContextEngine_Test_Device" --no-bundler
```

Result:
- `BUILD SUCCESSFUL`
- APK installed
- Expo development client URL opened on `ContextEngine_Test_Device`

2. Wrapper script verification

```bash
export PATH="/Users/meharaj/Library/Android/sdk/platform-tools:/Users/meharaj/Library/Android/sdk/emulator:$PATH"
cd apps/mobile
./scripts/run-android-simulator.sh
```

Result:
- Wrapper waited for emulator readiness
- `expo run:android` targeted `ContextEngine_Test_Device`
- `BUILD SUCCESSFUL`
- APK installed
- Expo development client URL opened on `ContextEngine_Test_Device`

## Files changed

- `apps/mobile/scripts/run-android-simulator.sh`
- `docs/development/DEVELOPMENT_ENVIRONMENT.md`
- `docs/development/BOOTSTRAP_COMMANDS.md`

## Concerns

1. The wrapper defaults to the host-specific AVD name `ContextEngine_Test_Device`. That is appropriate for this task because the brief explicitly says this AVD exists on this host, but it is still a host-specific default.
2. The shell printed `setlocale: LC_ALL: cannot change locale (C.UTF-8)` while running the wrapper. This did not affect the Android build/run result and appears to be a host shell environment issue, not a repo issue.

## Self-review

- Kept changes inside allowed paths plus the required report path.
- Did not touch unrelated mobile UI, bridge, or protocol files.
- Preferred the smallest reliable fix over changing native build configuration.
- Verified the exact scripted path instead of only the underlying manual command.

## Blockers

None for this task.
