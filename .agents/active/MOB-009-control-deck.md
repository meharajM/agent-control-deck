# Task: MOB-009 Single-Screen Agent Control Deck

Status: COMPLETE

## Owner role

Mobile application, with additive protocol documentation.

## Goal

Replace the tab-first mobile UI with one compact control deck that shows every active agent, reveals selected-agent details inline, retains completed agents for one hour unless dismissed, and exposes three configurable commands by default.

## Background

The existing Attention, Sessions, Diagnostics, and Settings tabs expose too much navigation for a compact supervision tool. The revised interaction model is inspired by a tactile agent controller: agent state keys first, contextual details second, and high-frequency commands within one reach.

## Dependencies

- Existing normalized mobile session store and UCP connection lifecycle
- Existing pairing, settings, diagnostics, approval, and session-detail routes
- Existing `expo-sqlite` dependency for non-secret mobile preferences

## Contracts consumed

- `docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md`
- `docs/product/ACCESSIBILITY.md`
- `docs/architecture/UCP_PROTOCOL.md`
- `schemas/ucp-capabilities.schema.json`
- ADR 0010 text-first voice beta

## Allowed paths

- `apps/mobile/**`
- `docs/product/**`
- `docs/architecture/UCP_PROTOCOL.md`
- `docs/planning/DEVELOPMENT_PLAN.md`
- `docs/planning/ROADMAP.md`
- `docs/planning/TASKS.md`
- `README.md`
- `schemas/ucp-capabilities.schema.json`
- `packages/protocol/src/capabilities.ts`
- `packages/protocol/src/validate.ts`
- `packages/protocol/src/__tests__/capabilities.test.ts`
- `apps/bridge/src/ucp-gateway.ts` (focus dispatch, capabilities, completion retention)
- `apps/bridge/src/bridge-app.ts` (optional host focus integration injection)
- `apps/bridge/src/__tests__/real-integration.test.ts` (focus and snapshot contract evidence)
- `apps/bridge/src/adapter-manager.ts` (persist authoritative session terminal states)
- `.agents/active/MOB-009-control-deck.md`
- `.agents/handoffs/MOB-009-control-deck.md`

## Forbidden paths

- Runtime adapter implementations
- Database migrations
- Pairing and cryptographic implementation
- Existing networking behavior

## Acceptance criteria

- [x] No bottom tab bar remains in the primary flow.
- [x] Every active/attention agent is visible; recently completed agents remain for one hour.
- [x] A completed agent can be dismissed and dismissal persists locally.
- [x] Tapping an agent reveals details inline and requests desktop focus only when advertised.
- [x] Focus failure is visible and does not block mobile details.
- [x] Three commands are selected by default and users can pin any available command count.
- [x] Setup, diagnostics, session history, and settings remain reachable from one overflow menu.
- [x] Offline state is visibly stale and all mutations are disabled.
- [x] Controls meet accessibility labeling and target-size requirements.

## Required tests

- Mobile unit tests for visibility, one-hour retention, ordering, and command availability.
- Protocol test for the additive desktop-focus capability.
- Mobile and protocol typecheck/tests.

## Security/privacy considerations

Desktop focus is capability-gated and must not be advertised until the host can target the exact session. Unknown or failed focus commands fail visibly. Approval detail and runtime-native decisions remain authoritative.

## Accessibility considerations

State uses text and symbols in addition to color. Agent keys and command controls have at least 48 dp targets, explicit labels, state, and hints. Text remains the v1 input path.

## Handoff recipient

Mobile, protocol, security, and accessibility reviewers.
