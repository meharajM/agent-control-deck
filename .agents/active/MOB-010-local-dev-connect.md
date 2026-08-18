# Task: MOB-010 Local Dev Bridge Shortcut

## Owner role

Mobile application.

## Goal

Make local Android simulator testing easier by adding a development-only shortcut on the pairing screen that fills the localhost bridge URL used by the bridge dev mode workflow, without changing the secure production pairing flow.

## Background

The current pairing screen requires manual entry of the bridge URL, which slows down local end-to-end testing and recording. The repository already supports a bridge dev mode for simulator-only testing. This task should surface that convenience in the UI for development builds only, so the app remains testable without weakening the shipped pairing model.

## Dependencies

- Existing bridge dev mode workflow
- Existing pairing screen and bridge URL validation
- Existing mobile connection state and saved bridge preference flow

## Contracts consumed

- `docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md`
- `docs/product/INSTALLATION_AND_USER_ONBOARDING.md`
- `docs/security/SECURITY_AND_THREAT_MODEL.md`
- `docs/architecture/LOCAL_FIRST_NETWORKING.md`

## Allowed paths

- `apps/mobile/**`
- `.agents/active/MOB-010-local-dev-connect.md`
- `.agents/handoffs/MOB-010-local-dev-connect.md`

## Forbidden paths

- Bridge runtime adapters
- Cryptographic or pairing protocol changes
- Database migrations
- Shared protocol/schema files

## Acceptance criteria

- [x] The pairing screen offers a dev-only shortcut that fills the localhost bridge URL used for simulator testing.
- [x] The shortcut is unavailable outside development builds.
- [x] Normal manual pairing continues to work unchanged.
- [x] No secure pairing behavior is weakened or removed.

## Required tests

- Mobile typecheck
- Mobile unit tests covering the pairing helper or shortcut behavior if new logic is added

## Security/privacy considerations

The shortcut is development-only and must not alter the secure pairing path or expose credentials. It should only reduce friction for local simulator testing.

## Accessibility considerations

The shortcut, if present, must have a clear label, role, and hint, and remain easy to discover alongside the existing pairing controls.

## Handoff recipient

Mobile reviewers.
