# Multi-Agent Development Plan

## 1. Purpose

This document defines how multiple AI coding agents and human reviewers can build Agent Deck in parallel without creating conflicting architecture, duplicated abstractions, or unsafe integrations.

## 2. Operating model

Use one coordinator agent and focused specialist agents. Humans approve architectural changes, security-sensitive changes, and cross-package interface changes.

### Coordinator

Owns:

- Task graph
- Scope control
- Contract changes
- Integration order
- Conflict resolution
- Release readiness

The coordinator should not implement every workstream. It maintains the source of truth and reviews handoffs.

### Specialist workstreams

1. Protocol/schema
2. Bridge core/persistence
3. Mobile application
4. Codex adapter
5. OpenCode adapter
6. Claude adapter (post-v1)
7. Security/networking
8. Test/chaos/accessibility
9. Release/observability

## 3. Repository ownership boundaries

| Workstream | Primary paths |
|---|---|
| Protocol | `packages/protocol`, `schemas`, `docs/protocol` |
| Bridge | `packages/bridge-*`, `apps/bridge-cli` |
| Mobile | `apps/mobile`, `packages/mobile-*` |
| Codex | `packages/adapter-codex` |
| OpenCode | `packages/adapter-opencode` |
| Claude | `packages/adapter-claude` |
| Security | `packages/crypto`, `packages/bridge-pairing`, relay security |
| QA | `tests`, fixtures, harnesses |
| Release | `infra`, workflows, installers |

Agents must not modify another workstream's primary path without an explicit cross-workstream task.

## 4. Contract-first development

Shared contracts are frozen per sprint:

- UCP schemas
- Adapter interface
- Database migration set
- Shared error codes
- Shared capability types

A specialist who needs a contract change submits a short proposal containing:

- Problem
- Proposed change
- Backward compatibility
- Affected workstreams
- Migration/test impact

The coordinator approves and publishes the change before dependent agents implement it.

## 5. Git strategy

Recommended:

- One issue/task ID per branch
- One worktree per active agent
- Branch names: `agent/<role>/<task-id>-short-name`
- Small PRs
- No direct commits to main
- Rebase/merge from main before handoff
- Generated files committed only by the owning workstream

Example:

```bash
git worktree add ../agentdeck-protocol -b agent/protocol/UCP-001-envelope
git worktree add ../agentdeck-mobile -b agent/mobile/MOB-001-session-board
```

## 6. Task format

Every task must specify:

- ID
- Owner role
- Goal
- Inputs/contracts
- Allowed paths
- Forbidden paths
- Acceptance criteria
- Required tests
- Dependencies
- Handoff recipient

Use `templates/TASK.md`.

## 7. Agent rules

Every coding agent must:

1. Read `AGENTS.md` and task file.
2. Inspect existing code before editing.
3. Stay within allowed paths.
4. Avoid speculative abstractions.
5. Add or update tests.
6. Run relevant checks.
7. Update docs if behavior changes.
8. Produce a structured handoff.
9. State uncertainties and unrun tests.
10. Never weaken security behavior to make a test pass.

## 8. Parallelization waves

### Wave 0 — contracts

Only protocol, architecture, security, and data-model agents work. No feature implementation proceeds until initial contracts are accepted.

### Wave 1 — independent foundations

Parallel:

- Bridge database/journal
- Fake adapter
- Mobile static navigation/components
- Test harness
- Monorepo tooling

Dependencies are mocked using frozen contracts.

### Wave 2 — first vertical slice

Integration agent combines:

- Fake adapter
- Bridge gateway
- Mobile session board
- Approval flow
- Replay/snapshot

No real runtime adapters merge before this slice is reliable.

### Wave 3 — runtime adapters

Codex and OpenCode agents work in parallel against the adapter conformance suite. Mobile agent works only on capability-driven rendering, not runtime-specific branches.

### Wave 4 — secure direct networking

Security/networking agent and mobile agent coordinate through pairing/transport schemas. Bridge core remains the authority for grants.

### Wave 5 — hardening

Chaos, accessibility, performance, and security agents run in parallel. Feature development pauses for critical reliability defects.

### Wave 6 — Post-v1 Claude beta and optional infrastructure

Claude adapter and optional relay can proceed in parallel after the Codex/OpenCode v1 release because both depend on stable bridge/UCP contracts, not each other. Neither is part of the v1 critical path or release gate.

## 9. Integration gates

### Gate A: schema

- JSON Schemas validate fixtures
- Compatibility tests pass
- No undocumented breaking changes

### Gate B: persistence

- Migration applies from clean DB
- Restart recovery passes
- Idempotency/concurrency tests pass

### Gate C: adapter

- Shared contract suite passes
- Unknown event behavior tested
- Runtime version recorded

### Gate D: mobile

- Physical-device smoke test
- Offline controls disabled
- Accessibility labels present

### Gate E: security

- No new unauthenticated endpoint
- Secret scan clean
- Threat-model delta reviewed

## 10. Handoff format

Every agent handoff includes:

- What changed
- Files changed
- Contracts used/changed
- Tests run and results
- Known limitations
- Security/privacy implications
- Follow-up tasks
- Suggested reviewer

Use `templates/HANDOFF.md`.

## 11. Conflict prevention

- One owner per migration number.
- One owner per schema file per sprint.
- Mobile never imports adapter implementation packages.
- Adapters never modify mobile code.
- Generated protocol types come only from schema tooling.
- Cross-package refactors require coordinator task.
- Do not combine formatting-only changes with feature changes.

## 12. Multi-agent test responsibility

Each feature agent writes unit tests. The QA agent owns:

- Cross-package integration tests
- Chaos harness
- Runtime compatibility matrix
- Mobile E2E scenarios
- Performance suites

QA does not replace feature-owner testing.

## 13. Review assignment

- Protocol changes: coordinator + bridge + mobile reviewer
- Database changes: bridge + QA reviewer
- Adapter changes: runtime specialist + QA reviewer
- Pairing/crypto: security reviewer mandatory
- Mobile approval UI: mobile + security + accessibility reviewer
- Relay: security + operations reviewers

## 14. AI-agent prompts

Use prompts in `prompts/`. Each prompt instructs the agent to preserve local-first and server-optional invariants.

## 15. Progress reporting

Daily/iteration report:

```text
Completed:
In progress:
Blocked:
Contract changes requested:
Tests failing:
Risks discovered:
Next integration point:
```

## 16. Recovery from poor agent work

If an agent produces broad or low-confidence changes:

1. Do not ask another agent to patch blindly.
2. Revert or isolate the branch.
3. Extract any valid tests/fixtures.
4. Rewrite the task with narrower allowed paths.
5. Assign a fresh agent/worktree.
6. Require a smaller PR.

## 17. Coordinator completion criteria

The coordinator closes a milestone only when:

- All contracts are documented
- Required tests run in CI
- Handoffs are complete
- Security/accessibility deltas reviewed
- Known limitations are visible in product/docs
- No workstream relies on unmerged private assumptions
