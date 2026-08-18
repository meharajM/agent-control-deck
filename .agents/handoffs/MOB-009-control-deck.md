# Handoff: MOB-009

## Summary

Replaced the primary tab UI with one adaptive agent control deck. The deck displays active and attention sessions, retains completed sessions for one hour, persists early dismissal and command preferences through Expo SQLite key-value storage, reveals selected details inline, and provides capability-filtered configurable commands. Added an optional exact-session desktop-focus UCP capability and command path with acknowledgement, visible failure, and retry behavior.

## Files changed

- `README.md`
- `docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md`
- `docs/product/ACCESSIBILITY.md`
- `docs/product/INSTALLATION_AND_USER_ONBOARDING.md`
- `docs/architecture/UCP_PROTOCOL.md`
- `docs/planning/DEVELOPMENT_PLAN.md`
- `docs/planning/ROADMAP.md`
- `docs/planning/TASKS.md`
- `schemas/ucp-capabilities.schema.json`
- `packages/protocol/src/capabilities.ts`
- `packages/protocol/src/validate.ts`
- `packages/protocol/src/__tests__/capabilities.test.ts`
- `apps/bridge/src/adapter-manager.ts`
- `apps/bridge/src/bridge-app.ts`
- `apps/bridge/src/ucp-gateway.ts`
- `apps/bridge/src/__tests__/real-integration.test.ts`
- `apps/mobile/src/app/(tabs)/_layout.tsx`
- `apps/mobile/src/app/(tabs)/index.tsx`
- `apps/mobile/src/app/(pairing)/index.tsx`
- `apps/mobile/src/app/(settings)/index.tsx`
- `apps/mobile/src/services/control-deck.ts`
- `apps/mobile/src/services/control-deck-preferences.ts`
- `apps/mobile/src/services/command-sender.ts`
- `apps/mobile/src/store/session-store.ts`
- `apps/mobile/src/types.ts`
- `apps/mobile/src/__tests__/control-deck.test.ts`
- `apps/mobile/src/__tests__/command-sender.test.ts`
- `apps/mobile/src/__tests__/session-store.test.ts`

## Contracts used or changed

- Added optional `desktopFocus` to UCP session capabilities.
- Added idempotent `session.focus`, acknowledged only after host integration completion.
- Client-provided command IDs are preserved in bridge acknowledgement payloads.
- Host snapshots retain completed sessions for one hour and include failed/interrupted sessions.
- Bridge session rows now persist authoritative terminal state transitions.

## Tests run

- `pnpm test`: passed, 25 workspace tasks.
- `pnpm typecheck`: passed, 13 workspace tasks.
- Mobile: 57 tests passed.
- Protocol: 30 tests passed.
- Bridge: 36 tests passed.
- `git diff --check`: passed.

## Tests not run

- Physical iOS/Android visual inspection.
- VoiceOver and TalkBack physical-device flows.
- Maestro E2E, because the repository still lacks recorded simulator/device release-gate evidence.

## Known limitations

- The bridge exposes a focus integration hook but no default OS/desktop implementation. `desktopFocus` remains false unless a host shell supplies a verified exact-session focus function. This prevents unsupported environments from pretending focus succeeded.
- Existing session payloads do not consistently include runtime and project labels, so the compact key uses the session title and state while expanded details remain the metadata surface.
- Dedicated push-to-talk remains post-v1 per ADR 0010; text and keyboard dictation are available now.

## Security/privacy impact

No credentials or runtime content were added to preferences. Dismissed IDs and command-layout preferences use the non-secret SQLite cache. Focus fails closed when unconfigured, and approval review continues to use the existing detail flow.

## Accessibility impact

Agent state uses text and symbols in addition to color. Keys, menu entries, commands, retry, dismissal, and input controls have labeled roles/states and at least 48 dp targets. Offline controls remain disabled, and status updates use live-region/alert semantics.

## Follow-up tasks

- Implement and validate an exact-session focus provider for each supported desktop shell before advertising `desktopFocus`.
- Add physical-device visual, maximum-text, VoiceOver/TalkBack, and Maestro evidence.
- Publish richer normalized runtime/project metadata and adapter-specific capability values in snapshots.

## Suggested reviewer

Mobile reviewer, protocol reviewer, security reviewer, and accessibility reviewer.
