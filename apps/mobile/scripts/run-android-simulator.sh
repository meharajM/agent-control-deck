#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_AVD="ContextEngine_Test_Device"
JAVA_HOME_DEFAULT="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
DEFAULT_ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"

if [ -n "${LC_ALL:-}" ] && ! locale -a | grep -Fxq "$LC_ALL"; then
  unset LC_ALL
fi

if [ -z "${JAVA_HOME:-}" ] && [ -d "$JAVA_HOME_DEFAULT" ]; then
  export JAVA_HOME="$JAVA_HOME_DEFAULT"
fi

if [ -n "${JAVA_HOME:-}" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi

if [ -z "${ANDROID_SDK_ROOT:-}" ] && [ -d "$DEFAULT_ANDROID_SDK_ROOT" ]; then
  export ANDROID_SDK_ROOT="$DEFAULT_ANDROID_SDK_ROOT"
fi

if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
  export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
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
METRO_PORT="${EXPO_PORT:-8081}"
METRO_LABEL="com.agentdeck.mobile.metro"

find_booted_emulator() {
  adb devices | awk '$2 == "device" && $1 ~ /^emulator-/ { print $1; exit }'
}

avd_exists() {
  emulator -list-avds | grep -Fxq "$1"
}

find_emulator_for_avd() {
  local target_avd="$1"
  local serial

  while read -r serial; do
    [ -n "$serial" ] || continue
    if [ "$(adb -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | head -n 1)" = "$target_avd" ]; then
      echo "$serial"
      return 0
    fi
  done < <(adb devices | awk '$2 == "device" && $1 ~ /^emulator-/ { print $1 }')

  return 1
}

boot_completed() {
  local device="$1"
  adb -s "$device" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -qx '1'
}

metro_listening() {
  lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN >/dev/null 2>&1
}

if ! avd_exists "$TARGET_AVD"; then
  echo "Android AVD '$TARGET_AVD' is not available on this host." >&2
  exit 1
fi

EMULATOR_ID="$(find_emulator_for_avd "$TARGET_AVD" || true)"

if [ -z "$EMULATOR_ID" ]; then
  echo "Starting Android emulator: $TARGET_AVD"
  nohup emulator @"$TARGET_AVD" >/tmp/agent-deck-android-emulator.log 2>&1 &

  SECONDS_WAITED=0
  until EMULATOR_ID="$(find_emulator_for_avd "$TARGET_AVD" || true)" && [ -n "$EMULATOR_ID" ]; do
    sleep 2
    SECONDS_WAITED=$((SECONDS_WAITED + 2))
    if [ "$SECONDS_WAITED" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
      echo "Timed out waiting for emulator serial for $TARGET_AVD after ${BOOT_TIMEOUT_SECONDS}s." >&2
      exit 1
    fi
  done
fi

echo "Waiting for Android emulator to become ready..."
adb -s "$EMULATOR_ID" wait-for-device

SECONDS_WAITED=0
until boot_completed "$EMULATOR_ID"; do
  sleep 2
  SECONDS_WAITED=$((SECONDS_WAITED + 2))
  if [ "$SECONDS_WAITED" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
    echo "Timed out waiting for $EMULATOR_ID to finish booting after ${BOOT_TIMEOUT_SECONDS}s." >&2
    exit 1
  fi
done

if ! metro_listening; then
  echo "Starting Expo Metro Bundler on port $METRO_PORT..."
  launchctl remove "$METRO_LABEL" 2>/dev/null || true
  launchctl submit -l "$METRO_LABEL" \
    -o /tmp/agent-deck-expo-start.log \
    -e /tmp/agent-deck-expo-start.log \
    -- /bin/zsh -lc "cd '$ROOT_DIR' && exec pnpm exec expo start --localhost --clear --port '$METRO_PORT'"

  SECONDS_WAITED=0
  until metro_listening; do
    sleep 1
    SECONDS_WAITED=$((SECONDS_WAITED + 1))
    if [ "$SECONDS_WAITED" -ge "$BOOT_TIMEOUT_SECONDS" ]; then
      echo "Timed out waiting for Metro Bundler on port $METRO_PORT after ${BOOT_TIMEOUT_SECONDS}s." >&2
      exit 1
    fi
  done
fi

adb -s "$EMULATOR_ID" reverse tcp:"$METRO_PORT" tcp:"$METRO_PORT" >/dev/null 2>&1 || true

DEVICE_NAME="$(adb -s "$EMULATOR_ID" emu avd name 2>/dev/null | tr -d '\r' | head -n 1)"
if [ -z "$DEVICE_NAME" ]; then
  DEVICE_NAME="$TARGET_AVD"
fi

DEV_CLIENT_URL="agentdeck://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${METRO_PORT}"

echo "Running Expo on emulator: $DEVICE_NAME ($EMULATOR_ID)"
cd "$ROOT_DIR"
cd "$ROOT_DIR/android"
./gradlew assembleDebug "$@"
adb -s "$EMULATOR_ID" install -r "$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk" >/dev/null
adb -s "$EMULATOR_ID" shell am start -W -a android.intent.action.VIEW -d "$DEV_CLIENT_URL" >/dev/null 2>&1 || true
