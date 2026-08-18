# Task: MOB-011 Code-Based Pairing

## Owner role

Coordinator and mobile application.

## Goal

Replace QR-first mobile onboarding with a copy/paste pairing-code flow that is easy to use in local development and simulator testing.

## Scope

- Bridge prints a one-time pairing code at startup.
- Mobile accepts the code as text and derives the bridge endpoint and pairing metadata.
- Android simulator instructions use `adb reverse` and the copied code.
- QR/camera onboarding is removed from the primary flow.

## Security boundary

Pairing codes remain expiring and one-time. This task does not remove authenticated transport from the secure production path. `BRIDGE_DEV_MODE=true` remains development-only and is the only plaintext compatibility path.

## Validation

- Mobile and bridge typechecks pass.
- Mobile, bridge, and OpenCode adapter tests pass.
- Android debug build installs and the simulator reaches the connected deck using the local shortcut.
