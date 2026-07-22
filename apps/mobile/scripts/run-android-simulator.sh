#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_AVD="ContextEngine_Test_Device"
JAVA_HOME_DEFAULT="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"

if [ -z "${JAVA_HOME:-}" ] && [ -d "$JAVA_HOME_DEFAULT" ]; then
  export JAVA_HOME="$JAVA_HOME_DEFAULT"
fi

if [ -n "${JAVA_HOME:-}" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is required on PATH." >&2
  exit 1
fi

if ! command -v emulator >/dev/null 2>&1; then
  echo "Android emulator binary is required on PATH." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required on PATH." >&2
  exit 1
fi

TARGET_AVD="${AGENT_DECK_ANDROID_AVD:-$DEFAULT_AVD}"
BOOT_TIMEOUT_SECONDS="${AGENT_DECK_ANDROID_BOOT_TIMEOUT_SECONDS:-180}"

find_booted_emulator() {
  adb devices | awk '$2 == "device" && $1 ~ /^emulator-/ { print $1; exit }'
}

boot_completed() {
  local device="$1"
  adb -s "$device" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -qx '1'
}

EMULATOR_ID="$(find_booted_emulator || true)"

if [ -z "$EMULATOR_ID" ]; then
  echo "Starting Android emulator: $TARGET_AVD"
  nohup emulator @"$TARGET_AVD" >/tmp/agent-deck-android-emulator.log 2>&1 &
  EMULATOR_ID="emulator-5554"
fi

echo "Waiting for Android emulator to become ready..."
adb wait-for-device

SECONDS_WAITED=0
until boot_completed "$EMULATOR_ID"; do
  sleep 2
  SECONDS_WAITED=$((SECONDS_WAITED + 2))
  if [ "$SECONDS_WAITED" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
    echo "Timed out waiting for $EMULATOR_ID to finish booting after ${BOOT_TIMEOUT_SECONDS}s." >&2
    exit 1
  fi
done

DEVICE_NAME="$(adb -s "$EMULATOR_ID" emu avd name 2>/dev/null | tr -d '\r' | head -n 1)"
if [ -z "$DEVICE_NAME" ]; then
  DEVICE_NAME="$TARGET_AVD"
fi

echo "Running Expo on emulator: $DEVICE_NAME ($EMULATOR_ID)"
cd "$ROOT_DIR"
pnpm exec expo run:android --device "$DEVICE_NAME" --no-bundler "$@"
