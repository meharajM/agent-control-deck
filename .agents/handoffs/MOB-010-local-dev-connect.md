# Handoff: MOB-010 Local Dev Bridge Shortcut

## What changed

- Added a `__DEV__`-only `Use Local Simulator Bridge` control to the mobile pairing screen.
- The control fills `ws://127.0.0.1:8765`, matching the documented Android `adb reverse` workflow.
- Manual URL entry, QR pairing, validation, and Connect behavior are unchanged.

## Files changed

- `apps/mobile/src/app/(pairing)/index.tsx`
- `.agents/active/MOB-010-local-dev-connect.md`
- `.agents/handoffs/MOB-010-local-dev-connect.md`

## Tests

- `pnpm --filter @agent-deck/mobile typecheck`
- `pnpm --filter @agent-deck/mobile test`

## Security and accessibility

- No bridge, protocol, runtime adapter, encryption, or pairing crypto code changed.
- The shortcut is excluded from production builds through `__DEV__` and has an accessible label, button role, and hint.

## Known limitations

- The shortcut fills the URL; the user still taps `Connect`, preserving the existing pairing/connection flow.
