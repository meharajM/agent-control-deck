# AGENTS.md — Agent Deck Repository Operating Contract

This file is the repository-wide instruction set for human contributors and AI coding agents working on Agent Deck.

Its purpose is to ensure that every agent:

- uses the complete revised product and architecture plan;
- preserves the local-first, optional-server product model;
- develops safely in parallel without overwriting another workstream;
- treats protocols, database migrations, security boundaries, and runtime adapters as shared contracts;
- writes tests alongside implementation;
- produces integration-ready handoffs instead of unreviewable code dumps;
- never hides blockers, skipped tests, assumptions, or compatibility uncertainty.

The instructions apply recursively to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory. A nested file may add stricter local rules but must not weaken the product, security, testing, accessibility, or local-first invariants defined here.

---

## 1. Product mission

Agent Deck is a local-first, server-optional Android and iOS command surface for supervising AI coding agents running on a user's own computer.

The supported runtimes are:

- OpenAI Codex;
- OpenCode;
- Claude Code through bridge-managed Claude Agent SDK sessions.

OpenClaw is out of scope.

The product is a compact supervision and decision interface, not a mobile IDE. It must let users understand what an agent is doing, see when it needs attention, make a safe decision, send a short steering instruction, and recover cleanly from connectivity failures without exposing unnecessary context.

---

## 2. Non-negotiable product invariants

Every implementation, refactor, dependency change, test, and document must preserve these invariants.

1. **Local-first:** Core LAN and private-network operation works without a vendor-operated cloud service.
2. **Optional server:** Relay, accounts, and remote push are optional modules and must never become prerequisites for local operation.
3. **Host bridge required:** The bridge runs on the user's computer and owns runtime connections, credentials, normalized state, persistence, approvals, and reconciliation.
4. **Credentials stay on host:** Runtime/provider credentials never move to mobile, relay, push payloads, fixtures, or logs.
5. **Runtime truth:** The runtime is authoritative for whether an action executed and how it completed.
6. **Bridge durability:** The bridge is authoritative for normalized mobile state, command acceptance, event sequencing, paired devices, and the approval ledger.
7. **Intermittent mobile client:** A phone socket is temporary. Important state must never live only in a mobile connection or in-memory callback.
8. **Idempotent mutations:** Every state-changing mobile command has an idempotency key and must be safe to retry.
9. **Authoritative approvals:** An approval is complete only after runtime confirmation or reconciliation. Sending a decision is not completion.
10. **First valid decision wins:** Concurrent devices resolve approvals through compare-and-set semantics.
11. **Fail closed:** Unknown approval types, unknown permission decisions, malformed security payloads, and unsupported runtime semantics are not remotely actionable.
12. **Capability-driven UI:** Mobile renders normalized capabilities. It must not branch on runtime names for feature behavior.
13. **Read-only stale mode:** Cached offline state is visibly stale and all state-changing controls are disabled.
14. **Content-blind relay:** Optional relay infrastructure routes encrypted frames and generic notification signals but cannot decrypt agent content.
15. **No public runtime ports:** Codex, OpenCode, and Claude integrations remain on loopback or local process transports behind the bridge.
16. **No self-signed TLS dependency for MVP LAN:** Direct LAN/private routes use pairing-authenticated, application-encrypted UCP frames over explicitly allowed local WebSocket. Public/relay routes use normal trusted `wss://` plus UCP frame encryption.
17. **Accessibility is required:** VoiceOver, TalkBack, text scaling, non-color state, large touch targets, and text alternatives are part of the definition of done.
18. **Text-first:** Text input and OS keyboard dictation are v1. Dedicated push-to-talk is beta and cannot block the core release.
19. **No mobile IDE drift:** Do not add a general terminal, remote desktop, arbitrary file browser, or full code editor to v1.
20. **No security shortcuts:** Never weaken pairing, authorization, approval behavior, redaction, or runtime policy to simplify development or make a test pass.

If a requested change conflicts with an invariant, stop and escalate to the coordinator with a proposed ADR. Do not implement the conflicting change silently.

---

## 3. Technology baseline

The accepted baseline is defined by `docs/development/TECH_STACK_AND_BLOCKER_AUDIT.md`, `docs/architecture/COMPATIBILITY_MATRIX.md`, and the accepted ADRs.

### Mobile

- Expo SDK 56
- React Native 0.85
- React 19.2
- TypeScript strict mode
- Expo development builds and Continuous Native Generation
- Expo Router
- Zustand with reducer-style normalized event application
- `expo-sqlite` for non-secret cache
- `expo-secure-store` for small device credentials
- `expo-local-authentication` for biometric gates
- `expo-camera` for QR pairing
- Native `WebSocket` for foreground communication
- React Native Testing Library for component tests
- Maestro for mobile E2E

### Bridge

- Node.js 24 LTS
- TypeScript ESM
- Fastify 5 for loopback health/admin endpoints
- `ws` for UCP WebSocket service
- `better-sqlite3` 12.x in WAL mode
- Zod for runtime validation
- Ajv for JSON Schema validation
- Pino with redaction
- Vitest for unit, contract, integration, and property tests

### Workspace and delivery

- pnpm workspaces with hoisted linker initially
- Turborepo for task orchestration
- GitHub Actions default CI
- Platform-specific bridge installers bundling Node 24 and native dependencies
- No Node SEA dependency
- EAS Build optional, not required

### Explicitly not part of the initial baseline

Do not introduce these without a measured need and an accepted ADR:

- Detox
- Node Single Executable Applications
- custom self-signed-certificate WebSocket pinning modules
- Redis, PostgreSQL, Kafka, NATS, or Kubernetes
- Electron for the bridge MVP
- mandatory mDNS discovery
- mandatory cloud accounts
- mandatory relay infrastructure
- binary serialization before JSON profiling proves the need
- dedicated speech recognition before core session/approval reliability

Do not replace a locked technology because another tool is more familiar. Submit an ADR with compatibility, migration, testing, packaging, and rollback impact.

---

## 4. Sources of truth and precedence

When instructions conflict, use this order:

1. The current explicit user or human maintainer instruction.
2. A coordinator-issued task file with approved scope.
3. Accepted ADRs under `docs/adr/`.
4. Frozen shared contracts for the active milestone: schemas, adapter interfaces, migrations, error codes, and crypto handshake.
5. This `AGENTS.md`.
6. Core product, architecture, security, and testing documents.
7. Role-specific plans and prompts.
8. Existing implementation and tests.
9. Comments, examples, and historical notes.

Existing code does not override an accepted architecture decision merely because it already exists. Conversely, planning prose does not justify deleting working behavior without a migration task.

When two documents at the same level disagree:

- do not choose the more convenient interpretation;
- record the conflict in the active task;
- notify the coordinator;
- resolve it through an ADR or contract update before dependent work proceeds.

---

## 5. Required use of the revised plan

All files in the blueprint are part of the development system. Agents must not treat them as optional background reading.

### 5.1 Mandatory orientation for every agent

Before editing code, read:

1. `README.md`
2. this `AGENTS.md`
3. the assigned task file
4. `docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md`
5. `docs/architecture/ARCHITECTURE.md`
6. `docs/development/TECH_STACK_AND_BLOCKER_AUDIT.md`
7. `docs/planning/DEVELOPMENT_PLAN.md`
8. `docs/planning/MULTI_AGENT_DEVELOPMENT_PLAN.md`
9. `docs/security/SECURITY_AND_THREAT_MODEL.md`
10. `docs/development/TESTING_STRATEGY.md`
11. `docs/planning/IMPLEMENTATION_READINESS_CHECKLIST.md`
12. every accepted ADR related to the task

The agent must then read the role-specific set below.

### 5.2 Plan-file usage map

| File or directory | Required use |
|---|---|
| `README.md` | Product overview, local-first promise, scope, and document index. |
| `docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md` | User-visible behavior, states, screens, interaction rules, non-goals, and success criteria. |
| `docs/architecture/ARCHITECTURE.md` | Component boundaries, state ownership, transport layering, process topology, and system invariants. |
| `docs/architecture/LOCAL_FIRST_NETWORKING.md` | LAN/private routes, application encryption, pairing, route selection, offline behavior, optional relay boundaries, and network failure handling. |
| `docs/architecture/UCP_PROTOCOL.md` | Phone-to-bridge protocol, envelopes, commands, events, sequencing, idempotency, replay, snapshots, errors, and capability negotiation. |
| `schemas/` | Machine-readable UCP contracts. Generated types and fixtures must derive from these files. |
| `docs/architecture/DATA_MODEL.md` | Normalized entities, state machines, retention, transaction rules, concurrency, snapshots, and migration policy. |
| `db/migrations/` | Canonical database schema history. Never edit an applied migration; add a new numbered migration. |
| `docs/architecture/RUNTIME_ADAPTERS.md` | Adapter interface and runtime-specific integration/recovery constraints for Codex, OpenCode, and Claude. |
| `docs/architecture/COMPATIBILITY_MATRIX.md` | Supported platform/runtime versions, release status, compatibility mode, and fallback policy. |
| `docs/architecture/SOURCE_NOTES.md` | Current primary-source notes. Reverify unstable runtime/API facts against official sources before changing integrations. |
| `docs/security/SECURITY_AND_THREAT_MODEL.md` | Trust boundaries, threats, security rules, approval safety, pairing, keys, redaction, and required reviews. |
| `docs/product/ACCESSIBILITY.md` | Accessibility acceptance criteria and test requirements. |
| `docs/operations/OBSERVABILITY.md` | Metrics, safe logging, diagnostics, and content-redaction requirements. |
| `docs/development/TECH_STACK_AND_BLOCKER_AUDIT.md` | Locked stack, rejected choices, known platform constraints, fallbacks, and blocker-removal decisions. |
| `docs/development/DEPENDENCY_POLICY.md` | Dependency admission, version pinning, native-module review, licensing, and upgrade policy. |
| `docs/development/DEVELOPMENT_ENVIRONMENT.md` | Supported developer environments, profiles, physical-device requirements, secrets handling, and no-account workflows. |
| `docs/development/BOOTSTRAP_COMMANDS.md` | Canonical repository bootstrap. Only the bootstrap/tooling owner changes foundational commands. |
| `docs/planning/DEVELOPMENT_PLAN.md` | Ordered phases, deliverables, exit criteria, MVP boundary, and dependency order. |
| `docs/planning/ROADMAP.md` | Milestone sequencing and post-MVP boundaries. |
| `docs/planning/TASKS.md` | Initial task IDs and workstream backlog. Create executable task files from these entries using `templates/TASK.md`. |
| `docs/planning/MULTI_AGENT_DEVELOPMENT_PLAN.md` | Parallelization waves, path ownership, contract freezes, integration gates, reviews, and recovery from poor agent work. |
| `prompts/` | Role-specific operating prompts. Use the matching prompt in addition to this file; prompts cannot weaken this file. |
| `templates/TASK.md` | Required task specification format. No implementation begins without equivalent scope information. |
| `templates/HANDOFF.md` | Required completion and cross-agent handoff format. |
| `templates/PR.md` | Required pull-request evidence and review fields. |
| `docs/operations/CI_CD.md` | Pull-request jobs, platform lanes, real-runtime restrictions, release pipelines, and branch protections. |
| `docs/development/TESTING_STRATEGY.md` | Unit, contract, integration, E2E, chaos, security, accessibility, performance, and release-gate requirements. |
| `docs/operations/RELEASE_AND_DEPLOYMENT.md` | Installer, mobile distribution, signing, update, rollout, and rollback expectations. |
| `docs/product/INSTALLATION_AND_USER_ONBOARDING.md` | End-user setup, pairing, runtime prerequisites, start-on-login, diagnostics, and no-server messaging. |
| `CONTRIBUTING.md` | Contributor workflow and review expectations. |
| `docs/planning/RISK_REGISTER.md` | Known risks, mitigations, triggers, and owners. Update it when implementation discovers a material new risk. |
| `docs/planning/IMPLEMENTATION_READINESS_CHECKLIST.md` | Milestone readiness checklist. The coordinator maintains evidence for each checked item. |
| `docs/planning/VALIDATION_REPORT.md` | Current blueprint validation status. Update after structural changes to plans, schemas, SQL, or packaging. |
| `MANIFEST.json` | Blueprint inventory. Keep it synchronized when plan artifacts are added, renamed, or removed. |
| `config/bridge.example.yaml` | Public, non-secret bridge configuration contract and safe defaults. |
| `config/.env.example` | Environment-variable names only. Never include real credentials or private endpoint details. |
| `docs/adr/` | Accepted architectural decisions. New cross-cutting decisions require a new sequential ADR. |

### 5.3 Role-specific reading sets

#### Coordinator

Read every planning file, every accepted ADR, all task/handoff files, current schemas, current migrations, CI configuration, and the status of every active worktree.

Use `prompts/COORDINATOR.md`.

#### Protocol/schema agent

Additionally read:

- `docs/architecture/UCP_PROTOCOL.md`
- `docs/architecture/DATA_MODEL.md`
- `docs/architecture/LOCAL_FIRST_NETWORKING.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`
- `schemas/`
- UCP-related ADRs
- `docs/operations/CI_CD.md`
- protocol and synchronization sections of `docs/development/TESTING_STRATEGY.md`

Use `prompts/PROTOCOL_AGENT.md`.

#### Bridge agent

Additionally read:

- `docs/architecture/DATA_MODEL.md`
- `docs/architecture/UCP_PROTOCOL.md`
- `docs/architecture/LOCAL_FIRST_NETWORKING.md`
- `docs/architecture/RUNTIME_ADAPTERS.md`
- `docs/operations/OBSERVABILITY.md`
- `docs/operations/RELEASE_AND_DEPLOYMENT.md`
- `docs/product/INSTALLATION_AND_USER_ONBOARDING.md`
- all database, bridge, networking, and packaging ADRs

Use `prompts/BRIDGE_AGENT.md`.

#### Mobile agent

Additionally read:

- `docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md`
- `docs/product/ACCESSIBILITY.md`
- `docs/architecture/LOCAL_FIRST_NETWORKING.md`
- `docs/architecture/UCP_PROTOCOL.md`
- `docs/security/SECURITY_AND_THREAT_MODEL.md`
- `docs/product/INSTALLATION_AND_USER_ONBOARDING.md`
- mobile sections of `docs/architecture/COMPATIBILITY_MATRIX.md`
- mobile and E2E sections of `docs/development/TESTING_STRATEGY.md`

Use `prompts/MOBILE_AGENT.md`.

#### Codex adapter agent

Additionally read:

- `docs/architecture/RUNTIME_ADAPTERS.md`
- `docs/architecture/UCP_PROTOCOL.md`
- `docs/architecture/DATA_MODEL.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`
- `docs/architecture/SOURCE_NOTES.md`
- adapter contract tests
- Codex-related ADRs and task acceptance criteria

Use `prompts/CODEX_ADAPTER_AGENT.md`.

#### OpenCode adapter agent

Additionally read the same adapter set, plus OpenCode permission and loopback-server requirements.

Use `prompts/OPENCODE_ADAPTER_AGENT.md`.

#### Claude adapter agent

Additionally read the same adapter set, plus Claude beta limitations, session durability rules, and the current Agent SDK API notes.

Use `prompts/CLAUDE_ADAPTER_AGENT.md`.

#### Security/networking agent

Additionally read:

- `docs/security/SECURITY_AND_THREAT_MODEL.md`
- `docs/architecture/LOCAL_FIRST_NETWORKING.md`
- `docs/architecture/UCP_PROTOCOL.md`
- `docs/architecture/DATA_MODEL.md`
- `docs/product/ACCESSIBILITY.md` for biometric and approval UX constraints
- security/networking ADRs
- `docs/development/DEPENDENCY_POLICY.md`
- security and chaos sections of `docs/development/TESTING_STRATEGY.md`

Use `prompts/SECURITY_AGENT.md`.

#### QA/chaos/accessibility agent

Additionally read all product behavior, architecture, protocol, data, runtime, security, accessibility, compatibility, CI, installation, release, risk, and observability documents.

Use `prompts/QA_AGENT.md`.

#### Release/packaging agent

Additionally read:

- `docs/development/TECH_STACK_AND_BLOCKER_AUDIT.md`
- `docs/development/DEVELOPMENT_ENVIRONMENT.md`
- `docs/development/DEPENDENCY_POLICY.md`
- `docs/operations/CI_CD.md`
- `docs/operations/RELEASE_AND_DEPLOYMENT.md`
- `docs/product/INSTALLATION_AND_USER_ONBOARDING.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`
- bundled-runtime and platform ADRs

---

## 6. External-fact verification

Runtime APIs, SDKs, Expo/React Native compatibility, mobile-platform policies, and packaging support can change.

When implementation depends on an unstable external fact:

1. verify it using current official primary documentation or the upstream repository;
2. record the checked version and date in the task or compatibility fixture;
3. update `docs/architecture/SOURCE_NOTES.md` and `docs/architecture/COMPATIBILITY_MATRIX.md` when the supported behavior changes;
4. add a compatibility test or proof fixture;
5. never rely only on an agent's memory or a secondary blog post.

Do not browse merely to replace repository decisions. External verification informs compatibility; accepted ADRs and coordinator-approved changes govern architecture.

---

## 7. Multi-agent operating model

### 7.1 Roles

Use one coordinator and focused specialists:

1. Coordinator/integration
2. Protocol/schema
3. Bridge core/persistence
4. Mobile application
5. Codex adapter
6. OpenCode adapter
7. Claude adapter
8. Security/networking
9. QA/chaos/accessibility
10. Release/packaging/observability

An agent may hold more than one role only when the coordinator explicitly assigns both and confirms that their write scopes do not conflict.

### 7.2 Coordinator authority

Only the coordinator may:

- assign task ownership;
- approve changes to frozen contracts;
- allocate migration numbers;
- allocate schema ownership for a sprint;
- approve cross-workstream edits;
- change integration order;
- mark readiness checklist items complete;
- resolve document conflicts;
- close milestones.

The coordinator should not implement broad feature work unless assigned a narrow integration task.

### 7.3 Coordination directory

When implementation begins, create and maintain:

```text
.agents/
  active/
    <TASK-ID>.md
  handoffs/
    <TASK-ID>.md
  status/
    coordinator.md
    protocol.md
    bridge.md
    mobile.md
    codex.md
    opencode.md
    claude.md
    security.md
    qa.md
    release.md
  locks/
    <scope>.json
  decisions/
    <proposal-id>.md
```

Rules:

- One active task file per implementation task.
- One status file per role to avoid write conflicts.
- A lock is a coordination lease, not a substitute for Git ownership.
- Locks include task ID, owner, paths, creation time, and expected release point.
- Expired or abandoned locks are cleared only by the coordinator.
- Handoffs are immutable after integration except for appended reviewer notes.

Do not create a single shared progress file that every agent edits concurrently.

### 7.4 Worktrees and branches

Use one Git worktree per active agent/task.

Branch pattern:

```text
agent/<role>/<task-id>-<short-name>
```

Examples:

```bash
git worktree add ../agentdeck-protocol -b agent/protocol/UCP-001-envelope
git worktree add ../agentdeck-bridge -b agent/bridge/BRG-002-event-journal
git worktree add ../agentdeck-mobile -b agent/mobile/MOB-004-session-board
```

Before editing, every agent must run:

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
```

Never:

- work directly on `main`;
- reuse another agent's worktree;
- reset, clean, revert, or overwrite another worktree;
- force-push a shared branch;
- include unrelated formatting changes;
- modify generated output owned by another workstream.

### 7.5 Path ownership

| Workstream | Primary write scope |
|---|---|
| Protocol | `packages/protocol/**`, `schemas/**`, `docs/protocol/**` |
| Adapter contract | `packages/adapter-contract/**`, shared adapter fixtures |
| Bridge | `apps/bridge/**`, `packages/bridge-*/**`, `packages/bridge-database/**` |
| Mobile | `apps/mobile/**`, `packages/mobile-*/**` |
| Codex | `packages/adapter-codex/**` |
| OpenCode | `packages/adapter-opencode/**` |
| Claude | `packages/adapter-claude/**` |
| Security | `packages/crypto/**`, `packages/bridge-pairing/**`, security fixtures |
| QA | `tests/**`, shared fake scenarios, harnesses, performance suites |
| Release | `infra/**`, installers, release workflows, packaging scripts |
| Documentation | Task-authorized documents only |

An agent must not modify another workstream's primary scope without:

- an explicit allowed-path entry in its task;
- coordinator approval;
- a named reviewer from the affected workstream.

### 7.6 No drive-by contract edits

A feature agent may consume shared contracts but must not casually edit them.

Protected surfaces include:

- `schemas/**`
- `packages/protocol/**`
- `packages/adapter-contract/**`
- `db/migrations/**`
- shared error-code definitions
- capability definitions
- pairing/crypto handshake
- public bridge configuration
- package baseline versions
- installer layout

A requested change requires a proposal containing:

- current limitation;
- proposed change;
- compatibility impact;
- migration impact;
- security/privacy impact;
- affected agents/workstreams;
- fixture/test changes;
- rollback plan.

Dependent work waits for coordinator approval and an updated frozen contract.

---

## 8. Parallel development waves

Follow the dependency order in `docs/planning/DEVELOPMENT_PLAN.md` and `docs/planning/MULTI_AGENT_DEVELOPMENT_PLAN.md`.

### Wave 0 — readiness spikes and frozen contracts

Parallel work is limited to:

- `SPIKE-001` through `SPIKE-008`;
- UCP envelope/capability/command contracts;
- adapter interface;
- initial data model and migration verification;
- threat-model review;
- bootstrap and CI validation.

Feature agents may build mocks against frozen fixtures but must not invent missing contracts.

### Wave 1 — independent foundations

Safe parallel tasks include:

- protocol code generation and validation;
- bridge database/journal/idempotency services;
- fake adapter scenario engine;
- static mobile navigation and accessible components;
- test harness and CI fast lane;
- repository tooling.

### Wave 2 — fake-runtime vertical slice

Integrate:

- fake adapter;
- bridge UCP gateway;
- pairing-development fixture;
- session board;
- approval flow;
- command ledger;
- replay/snapshot;
- stale/offline behavior.

Do not merge real runtime adapters into the main product path until this slice passes reconnect and duplicate-prevention tests.

### Wave 3 — Codex and OpenCode in parallel

Codex and OpenCode agents implement against the same conformance suite. Mobile remains runtime-neutral and consumes capabilities only.

### Wave 4 — secure direct networking

Security, bridge, and mobile agents coordinate through frozen pairing and encrypted-frame contracts.

### Wave 5 — hardening

QA, security, accessibility, performance, and packaging work in parallel. Feature expansion pauses for critical correctness or security findings.

### Wave 6 — Claude beta and optional infrastructure

Claude managed-session beta, Tailscale/private routing, optional relay, push, and tray UI can proceed independently after stable bridge/UCP contracts. None may become a core dependency.

---

## 9. Task lifecycle

No agent starts implementation from a chat sentence alone. Convert work into a task using `templates/TASK.md` or equivalent metadata.

### 9.1 Required task fields

- Task ID and title
- Owner role
- Goal
- Background
- Dependencies
- Contracts consumed
- Allowed paths
- Forbidden paths
- Acceptance criteria
- Required tests
- Security/privacy considerations
- Accessibility considerations
- Handoff recipient

### 9.2 Preflight

Before editing:

1. Read the mandatory and role-specific documents.
2. Inspect the current code and tests.
3. Confirm branch/worktree and clean status.
4. Confirm allowed and forbidden paths.
5. Confirm dependencies are merged or explicitly mocked.
6. Identify every shared contract consumed.
7. Check active locks and parallel tasks.
8. Identify required test layers.
9. Identify platform or runtime credentials that are unavailable.
10. Write a concise implementation plan in the task/status file.

If any required scope, dependency, contract, or acceptance criterion is missing, mark the task `BLOCKED-SPEC` and ask the coordinator. Do not guess a public interface.

### 9.3 Implementation

- Make the smallest coherent change that satisfies the task.
- Prefer vertical behavior over speculative frameworks.
- Reuse repository abstractions only when they match the contract.
- Keep generated artifacts reproducible.
- Add migrations instead of mutating released schema history.
- Update documentation when behavior or compatibility changes.
- Add tests in the same branch as the behavior.
- Do not silence type errors, lint rules, schema validators, or security checks without an approved task.

### 9.4 Self-review

Before handoff:

- inspect the complete diff;
- remove debug output and dead code;
- verify no secrets or private payloads entered fixtures/logs;
- verify only allowed paths changed;
- verify public behavior against product docs;
- verify failure and reconnect behavior;
- verify accessibility for user-facing changes;
- verify compatibility/version behavior for adapters;
- update task checklist and risk notes.

### 9.5 Handoff

Create `.agents/handoffs/<TASK-ID>.md` using `templates/HANDOFF.md`.

The handoff must state:

- what changed;
- every file changed;
- contracts consumed or changed;
- tests run with exact commands and results;
- tests not run and why;
- known limitations;
- security/privacy impact;
- accessibility impact;
- follow-up tasks;
- suggested reviewer;
- commit/branch identifier.

A statement such as “tests should pass” is not test evidence.

---

## 10. Implementation rules by layer

### 10.1 Protocol

- JSON Schema is the machine-readable source of truth for UCP wire shapes.
- Generate TypeScript types; do not hand-maintain divergent duplicate wire types.
- Unknown fields are handled according to explicit compatibility policy.
- Every mutation has command ID, idempotency key, and expected version where relevant.
- Host events use monotonic sequence numbers.
- Replay and snapshot application must converge to identical normalized state.
- Applying the same event twice must be safe.
- Breaking changes require a protocol version, migration notes, fixtures, and coordinator approval.

### 10.2 Bridge

- Persist command acceptance before runtime dispatch.
- Persist runtime event and normalized state changes atomically when they represent one logical event.
- Do not report completion without runtime confirmation.
- Reconcile adapters after bridge or runtime restart before accepting mutations.
- Keep adapters on local process/loopback transports.
- Keep optional relay code behind interfaces and feature flags.
- Expose health/admin endpoints only on loopback unless a reviewed design says otherwise.
- Apply Pino redaction before logs leave the call site.

### 10.3 Database

At startup, preserve the documented SQLite settings:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

Rules:

- one migration number owner at a time;
- never edit a released/applied migration;
- migrations are sequential and deterministic;
- destructive changes require backup and rollback plan;
- test clean install and upgrade from supported previous versions;
- unique idempotency keys are enforced in the database;
- approval transitions use compare-and-set;
- database schema newer than supported causes a safe refusal, not automatic downgrade.

### 10.4 Mobile

- Import protocol/shared types, never runtime adapter implementations.
- Render capabilities, not runtime-name conditions.
- Disable mutations while disconnected, degraded-before-sync, or stale.
- Clearly distinguish draft, sent, accepted, dispatched, confirmed, and completed.
- Do not store runtime credentials, raw repository contents, or unnecessary transcripts.
- Keep secure keys/tokens in SecureStore and small enough for its supported usage.
- Use SQLite for non-secret cache.
- Use Expo development builds as the canonical environment, not Expo Go.
- Every control has accessibility label, role, state, and adequate touch target.
- Do not add voice-only or gesture-only functionality.

### 10.5 Runtime adapters

All adapters must:

- implement the shared adapter contract;
- publish capabilities only after a successful probe;
- preserve runtime IDs;
- validate external payloads;
- isolate raw payloads from normal logs;
- support managed/attached ownership explicitly;
- reconcile after restart;
- pass the shared conformance suite;
- report runtime version, adapter version, minimum supported version, maximum tested version, disabled features, and last compatibility test date;
- enter compatibility mode for newer-than-tested runtimes;
- disable remote approval when an approval schema is unknown.

#### Codex

- Prefer `codex app-server` over terminal scraping.
- Prefer stdio/JSONL, then Unix socket.
- Treat TCP WebSocket app-server transport as advanced/experimental.
- Perform initialize/initialized lifecycle.
- Generate/load version-matched schemas.
- Implement threads, turns, items, approvals, questions, steering, interruption, and reconciliation.

#### OpenCode

- Keep `opencode serve` on `127.0.0.1` behind the bridge.
- Authenticate the server with a generated or user-provided secret.
- Use documented HTTP/OpenAPI/SSE behavior.
- Implement sessions, status, prompts, abort, permissions, diffs, events, and recovery.
- Never silently rewrite the user's permission policy.

#### Claude

- Use current supported Agent SDK `query()` flows, session IDs, resume, fork, partial output where needed, `Query.interrupt()`, and `canUseTool`.
- Do not use removed experimental V2 session APIs.
- Persist session ID and working directory.
- Treat bridge-managed sessions as beta until recovery behavior is proven.
- Treat arbitrary independently launched CLI attachment as experimental.
- Never infer that an interrupted in-process permission callback was approved.

### 10.6 Security/networking

- Pairing QR codes are one-time and expiring.
- Device identities and grants are per device and revocable.
- Direct LAN/private UCP frames are application encrypted and authenticated after handshake.
- Reject unencrypted application frames after secure-session establishment.
- Reject replay, tampering, sequence rollback, invalid grants, expired nonces, and oversized frames.
- Public/relay routes use trusted TLS plus UCP end-to-end frame encryption.
- QR/manual endpoint pairing is mandatory; mDNS is optional.
- No runtime, prompt, command, path, diff, or code content in push payloads.
- Cryptographic changes require security-agent and human review.
- Use audited libraries; do not design new cryptographic primitives.

### 10.7 Optional relay and push

- Relay cannot be part of the local MVP critical path.
- Bridge and phone initiate outbound connections.
- Relay routes opaque frames and presence only.
- Relay outage must not corrupt bridge state or prevent LAN/private use.
- Push notifications are generic attention signals; the app reconnects for encrypted details.
- Do not promise reliable background push in no-server mode.

### 10.8 Accessibility

For every user-facing feature:

- provide VoiceOver and TalkBack semantics;
- support platform text scaling;
- use at least 48x48 density-independent-pixel touch targets;
- pair color with text/icon/shape;
- provide alternatives to gestures, speech, haptics, and motion;
- avoid announcing streaming token noise;
- announce meaningful attention and completion states;
- test approval and reconnect flows with assistive technology.

### 10.9 Observability

- Metrics may include counts, durations, states, runtime type, and opaque identifiers.
- Logs must not include prompts, source code, secrets, raw audio, or complete sensitive paths.
- Diagnostics bundles are sanitized and user-controlled.
- Any new metric or log field receives a privacy review.
- Test redaction with adversarial secret fixtures.

---

## 11. Testing contract

Feature ownership includes test ownership. The QA agent supplements feature tests; it does not replace them.

### 11.1 Required layers by change type

| Change | Minimum required evidence |
|---|---|
| Pure utility/internal logic | Unit tests, typecheck, lint |
| UCP/schema | Schema fixtures, compatibility tests, generated-type check, replay/idempotency tests where relevant |
| Database | Clean migration, upgrade migration, transaction/concurrency tests, restart recovery |
| Bridge command/approval | Unit, integration with fake adapter, duplicate retry, disconnect timing, restart recovery |
| Mobile component | Component tests, accessibility assertions, stale/disabled-state test |
| Mobile flow | Maestro flow on at least one platform; both platforms before milestone close |
| Adapter | Shared conformance suite, real-runtime isolated integration when credentials are available, version fixture |
| Pairing/crypto/network | Unit vectors, tamper/replay tests, physical iOS and Android LAN smoke test |
| Installer | Target-OS build, install/start/doctor/uninstall smoke test, native SQLite load |
| Relay/push | Local independence test, E2E encryption verification, outage/fallback test, privacy review |
| Accessibility behavior | VoiceOver/TalkBack/manual evidence plus automated semantic assertions |

### 11.2 Canonical checks

Use scripts defined in the repository rather than inventing alternative commands. The expected top-level checks are:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Additional intended checks include:

```bash
pnpm --filter @agent-deck/mobile expo doctor
pnpm --filter @agent-deck/mobile test
pnpm --filter @agent-deck/bridge test
pnpm --filter @agent-deck/bridge doctor
```

When native configuration changes:

```bash
pnpm --filter @agent-deck/mobile expo prebuild --clean
pnpm --filter @agent-deck/mobile expo run:android
pnpm --filter @agent-deck/mobile expo run:ios
```

Run Maestro against built binaries for required flows.

If a script does not yet exist, the task must either create the canonical script or clearly state that the check is unavailable. Never report a command as passing when it was not run.

### 11.3 Required reliability properties

Tests must prove:

- replay produces the same state as a full snapshot;
- applying an event twice is safe;
- older session versions cannot overwrite newer state;
- an expired cursor triggers snapshot reset;
- mutations remain disabled until synchronization completes;
- retried commands do not dispatch twice;
- only one device resolves a pending approval;
- phone disconnect never implies approval;
- bridge restart never auto-approves;
- runtime cancellation removes actionability;
- unknown approvals fail closed;
- normalized state converges to runtime truth after injected failures.

### 11.4 Real-runtime tests

- Never run real-runtime credentials on untrusted/forked PR code.
- Use disposable repositories.
- Use explicit profiles: `fake`, `codex-local`, `opencode-local`, `claude-local`, `all-local`.
- Deny destructive/network operations unless the fixture specifically requires them.
- Upload only redacted artifacts.
- A contributor without runtime credentials must still be able to complete protocol, bridge-core, mobile-state, fake-adapter, and documentation tasks.

### 11.5 No-server proof

Before MVP milestone closure, run an end-to-end test with external internet blocked:

- bridge starts;
- phone pairs on LAN/private route;
- fake or local runtime session appears;
- command/approval flow works;
- reconnect/replay works;
- no relay/account/push dependency is invoked.

---

## 12. Dependency and package rules

Before adding a dependency:

1. explain the concrete feature need;
2. check whether the platform or current stack already provides it;
3. review maintenance, license, security history, native compatibility, bundle/install impact, and platform support;
4. verify it supports the locked Node/Expo/React Native versions;
5. add the smallest direct dependency at the owning workspace;
6. pin according to `docs/development/DEPENDENCY_POLICY.md`;
7. add build/test coverage on affected platforms;
8. update notices/SBOM requirements if relevant.

Do not add infrastructure because it may be useful later.

For React Native monorepo safety:

- keep one React, React Native, and Expo version through root overrides;
- every workspace declares its direct dependencies;
- run `pnpm why react react-native expo` in CI;
- do not reintroduce obsolete manual Metro monorepo resolver hacks.

---

## 13. Blocker protocol

A blocker is not permission to invent a workaround that violates the plan.

Use one of these states:

- `BLOCKED-SPEC`: task/contract ambiguity
- `BLOCKED-DEPENDENCY`: prerequisite branch or contract not merged
- `BLOCKED-ENV`: missing platform SDK, runtime credential, device, or target OS
- `BLOCKED-UPSTREAM`: documented upstream defect or incompatible version
- `BLOCKED-SECURITY`: safe implementation or review is unavailable
- `BLOCKED-TEST`: required evidence cannot currently be produced

A blocker report includes:

- exact failing command or scenario;
- relevant logs with secrets removed;
- environment and versions;
- what was attempted;
- whether fake/mock validation is still possible;
- safe fallback options;
- recommended owner and next action.

Do not claim the entire project is blocked when only one optional platform, runtime, voice feature, relay feature, or real-runtime integration test is unavailable.

---

## 14. Review and integration gates

### Gate A — stack readiness

- Expo/React Native monorepo builds on Android and iOS.
- Node 24 plus `better-sqlite3` loads on release targets.
- Maestro basic flow runs.
- Runtime proof spikes are recorded.
- Internet-blocked local flow succeeds.

### Gate B — shared contracts

- JSON Schemas validate all fixtures.
- Generated types are current.
- Adapter interface is accepted.
- Migration applies cleanly.
- Compatibility behavior is documented.

### Gate C — fake vertical slice

- Pair/connect.
- List session.
- Receive approval.
- Approve once.
- Drop connection around ACK.
- Reconnect.
- No duplicate runtime action.
- Complete session.

### Gate D — runtime adapter

- Conformance suite passes.
- Runtime version is reported.
- Unknown event/approval behavior is tested.
- Restart and reconciliation pass.

### Gate E — mobile

- Physical device smoke test.
- Offline state visibly stale and read-only.
- Accessibility semantics present.
- Minimum and current OS targets compile.

### Gate F — security

- No unauthenticated control endpoint.
- Pairing replay/revocation tests pass.
- Frame tamper/replay tests pass.
- Secret/log/push scans are clean.
- Threat-model delta reviewed.

### Gate G — release

- Target installers contain Node runtime, native database module, schemas, migrations, licenses, SBOM, and checksums.
- Install/start/doctor/uninstall smoke tests pass.
- Mobile store/internal builds pass core Maestro flow.
- Rollback procedure is tested.

No milestone is complete because code was written. It is complete only when its exit criteria and evidence are accepted.

---

## 15. Pull requests, commits, and generated files

### Pull requests

Use `templates/PR.md`.

A PR must be:

- tied to one task ID;
- limited to authorized scope;
- small enough for the assigned reviewers;
- explicit about contract, migration, security, privacy, accessibility, and rollback impact;
- accompanied by exact test evidence;
- free of unrelated formatting churn.

### Commits

Prefer coherent commits that keep tests with behavior. Suggested format:

```text
<task-id>: <imperative summary>
```

Examples:

```text
BRG-003: persist idempotency records before dispatch
MOB-007: disable mutations while cached state is stale
CDX-005: fail closed for unknown approval payloads
```

### Generated files

- Generated protocol types are produced only by approved schema tooling.
- Do not hand-edit generated files.
- Commit generated output only when repository policy requires it.
- CI must detect stale generated output.
- The owning workstream controls generator changes.

---

## 16. Documentation maintenance

Update documents in the same task when behavior changes.

Examples:

- Architecture boundary change → ADR plus `docs/architecture/ARCHITECTURE.md`.
- UCP change → `docs/architecture/UCP_PROTOCOL.md`, schemas, fixtures, compatibility notes.
- Database change → `docs/architecture/DATA_MODEL.md`, new migration, upgrade tests.
- Runtime support change → `docs/architecture/RUNTIME_ADAPTERS.md`, `docs/architecture/COMPATIBILITY_MATRIX.md`, `docs/architecture/SOURCE_NOTES.md`.
- Security change → `docs/security/SECURITY_AND_THREAT_MODEL.md`, threat tests, ADR if cross-cutting.
- User-visible behavior change → `docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md`, accessibility and test updates.
- Stack/dependency change → `docs/development/TECH_STACK_AND_BLOCKER_AUDIT.md`, `docs/development/DEPENDENCY_POLICY.md`, bootstrap/CI/release docs.
- New risk → `docs/planning/RISK_REGISTER.md`.
- Readiness evidence → `docs/planning/IMPLEMENTATION_READINESS_CHECKLIST.md`.

After adding, renaming, or deleting planning artifacts, update `MANIFEST.json` and rerun blueprint validation.

---

## 17. Definition of done for an agent task

A task is done only when all applicable statements are true:

- Acceptance criteria are demonstrably met.
- Only authorized files changed.
- Code follows frozen contracts.
- Required tests pass.
- Failure, reconnect, duplicate, and restart paths are covered where relevant.
- Security and privacy impact is documented.
- Accessibility impact is documented.
- Runtime/platform compatibility is recorded.
- Documentation and fixtures are updated.
- No secrets or sensitive content exist in code, logs, screenshots, fixtures, or commits.
- The branch is rebased or updated against its integration base without hiding conflicts.
- A complete handoff exists.
- Tests not run are explicitly listed with reason and owner.
- A suggested reviewer is named.

The agent must not self-approve its own cross-cutting contract, migration, cryptographic, or release change.

---

## 18. Stop conditions

Stop implementation and escalate when:

- a task requires making local operation depend on a server;
- a runtime credential would need to move to mobile or relay;
- an approval type cannot be safely mapped;
- a crypto or identity design is unclear;
- two agents claim the same path or migration number;
- an upstream API differs materially from the documented contract;
- a requested dependency conflicts with the locked Expo/React Native/Node baseline;
- a migration risks data loss without backup/rollback;
- test failures indicate duplicate state-changing execution;
- normalized state does not converge after reconnect/restart;
- accessibility cannot be provided for a required interaction;
- the task would add arbitrary terminal/file/desktop control to v1;
- the agent cannot produce the required test evidence.

Partial, honest progress with a structured blocker report is better than an unsafe workaround or an unsupported claim of completion.

---

## 19. Coordinator status format

Each iteration should publish:

```text
Completed:
In progress:
Blocked:
Contract changes requested:
Tests failing:
Risks discovered:
Compatibility changes:
Next integration point:
```

The coordinator should keep the task graph, active worktree list, contract freeze, migration allocation, readiness checklist, and integration order current.

---

## 20. Initial execution order

Unless a maintainer changes priorities, begin with:

1. `SPIKE-001` Expo SDK 56 pnpm-monorepo iOS/Android build.
2. `SPIKE-002` physical-device application-encrypted LAN WebSocket.
3. `SPIKE-003` bundled Node 24 plus `better-sqlite3` installer smoke tests.
4. `SPIKE-004` Maestro pairing/session/approval flow.
5. `UCP-001` through `UCP-003` protocol contracts and generated types.
6. `DB-001` initial migration test.
7. `ADP-001` shared adapter contract.
8. `QA-001` deterministic fake runtime scenarios.
9. `BRG-001` through `BRG-007` bridge vertical-slice components.
10. `MOB-001` through `MOB-008` mobile vertical-slice components.
11. Fake-runtime integration gate.
12. Codex and OpenCode proof/integration tasks in parallel.
13. Security pairing/direct-network tasks.
14. Hardening and no-internet local-first gate.
15. Claude managed-session beta.
16. Optional relay/push only after local release criteria are met.

---

## 21. Final agent reminder

The central engineering rule is:

> The mobile connection is temporary, bridge state is durable, and runtime execution is authoritative.

The central product rule is:

> Show the smallest amount of context that lets the user make a safe, informed decision.

The central delivery rule is:

> Parallel work is allowed only when contracts, ownership, tests, and handoffs make integration predictable.
