# Handoff: REAL-ENDTO-END-ANDROID

## Summary

Verified the Android emulator end-to-end on the real simulator using the repository's validated wrapper script.

- The wrapper reused the existing AVD `ContextEngine_Test_Device`.
- The debug build completed successfully and installed on `emulator-5554`.
- The app was already in the foreground on the connected sessions screen and showed a live connected state with one active session.
- The bridge was reachable on `127.0.0.1:8765`.
- No user-visible blocker occurred during the mobile launch/connect path.

## Files changed

- `.agents/handoffs/REAL-ENDTO-END-ANDROID.md`

## Contracts used or changed

- Used the documented Android simulator wrapper: `apps/mobile/scripts/run-android-simulator.sh`
- Used the local pairing/bridge workflow documented in `README.md` and `RUNNING.md`
- No contract changes

## Tests run

Commands run:

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
sed -n '48,90p' README.md
sed -n '48,90p' docs/development/DEVELOPMENT_ENVIRONMENT.md
sed -n '100,125p' docs/development/BOOTSTRAP_COMMANDS.md
sed -n '1,220p' apps/mobile/scripts/run-android-simulator.sh
lsof -nP -iTCP:8765 -sTCP:LISTEN
ps -ef | rg "bridge|expo start|metro|emulator|agent-deck|opencode|codex"
sed -n '1,140p' apps/bridge/src/main.ts
sed -n '1,220p' 'apps/mobile/src/app/(pairing)/index.tsx'
sed -n '1,220p' apps/mobile/src/services/pairing.ts
sed -n '1,220p' RUNNING.md
./apps/mobile/scripts/run-android-simulator.sh
adb -s emulator-5554 shell dumpsys window windows | rg -n "mCurrentFocus|mFocusedApp|mResumedActivity"
adb -s emulator-5554 exec-out screencap -p > /tmp/agentdeck-android/current.png
adb -s emulator-5554 shell getprop sys.boot_completed
adb -s emulator-5554 shell dumpsys activity activities | rg -n "ResumedActivity|topResumedActivity|mResumedActivity|mFocusedApp"
adb -s emulator-5554 logcat -d | rg -n "127\\.0\\.0\\.1:8765|Connected|connecting|bridge|Agent Deck|WebSocket" | tail -n 80
```

Observed results:

- `./apps/mobile/scripts/run-android-simulator.sh` reported `Waiting for Android emulator to become ready...`
- The wrapper reused the already running AVD `ContextEngine_Test_Device` and identified it as `emulator-5554`
- `BUILD SUCCESSFUL in 3s`
- `adb shell getprop sys.boot_completed` returned `1`
- Emulator screenshot showed the Agent Deck main screen with `Connected`, `Session`, and `Working`
- `dumpsys activity` showed `com.agentdeck.mobile/.MainActivity` as the resumed/focused activity

## Tests not run

- No Maestro flow
- No separate bridge test suite
- No explicit pairing JSON submission, because the app was already connected when inspected and the bridge stdout for the existing process was not recoverable from the terminal session

## Known limitations

- The bridge pairing JSON was not captured from the already-running bridge process stdout.
- I did not restart the bridge to regenerate pairing output because the app was already connected and the simulator path was past the first blocker.

## Security/privacy impact

- No credentials were collected or written.
- No pairing secrets were logged.

## Accessibility impact

- Not assessed in this verification pass.

## Follow-up tasks

- If a fresh pairing-code capture is needed for documentation, restart the bridge in a controlled session and record the emitted JSON.
- If the app must be proven from a clean profile, clear simulator app data and repeat the wrapper plus pairing flow.

## Suggested reviewer

- Mobile/bridge integration owner
