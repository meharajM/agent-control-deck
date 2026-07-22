# Agent Deck

A local-first, server-optional mobile command surface for controlling AI coding agents running on a user's own computer.

## V1 supported runtimes

- OpenAI Codex
- OpenCode

Claude Code through bridge-managed Claude Agent SDK sessions is a post-v1 target. The v1 release does not require or advertise Claude support.

OpenClaw is intentionally outside the scope of this repository plan.

## Problem statement

Coding agents increasingly run for long periods and frequently need small but important human decisions: approve a command, reject a risky change, answer a question, change direction, raise or lower reasoning effort, or stop a failing task. Existing interfaces are runtime-specific and often expose far more context than a phone user needs.

Agent Deck provides one low-context mobile interface that answers four questions:

1. What is the agent doing?
2. Does it need the user?
3. What decision is required?
4. What will happen after that decision?

The primary app surface is a single control deck: every active agent appears as a state key, tapping a key reveals details, and three configurable high-frequency commands remain within reach. Recently completed agents stay visible for one hour unless dismissed. Setup, diagnostics, and history remain available without occupying persistent navigation.

## Local-first promise

The base product works without a vendor-operated cloud server.

```text
Mobile app -- local Wi-Fi/private network --> Host bridge --> Coding runtimes
```

The host bridge is required and runs on the user's machine. A managed relay is optional and may be added later for frictionless remote connectivity and push notifications. LAN and private-network operation remain functional when all optional hosted services are unavailable.

## Start the bridge

Build the workspace before the first launch:

```bash
pnpm install
pnpm build
```

The bridge uses the `BRIDGE_RUNTIME` selector to start exactly one runtime adapter. Use one of these explicit commands:

```bash
pnpm start:bridge:fake
pnpm start:bridge:codex
pnpm start:bridge:opencode
```

The equivalent direct form is `BRIDGE_RUNTIME=fake pnpm start:bridge`, replacing `fake` with `codex` or `opencode`. The default bridge port is `8765`; override it without changing runtime selection, for example `BRIDGE_PORT=9000 pnpm start:bridge:codex`. Runtime credentials remain on the host and must not be placed in command output, documentation, or logs.

## Repository status

This repository now contains both the blueprint and an active implementation. Current validated state:

- `apps/bridge` and bridge packages implement the host bridge, UCP gateway, ledgers, snapshots, and runtime supervision layers.
- `apps/mobile` implements the mobile shell, session and approval flows, pairing routes, and route-selection and diagnostics flows.
- Runtime packages for fake, Codex, OpenCode, and Claude adapters are present. Codex and OpenCode remain the only v1 release-gated runtimes.
- Security and pairing foundations exist in `packages/crypto` and `packages/bridge-pairing`.
- QA harnesses and conformance and chaos scenarios exist in `packages/qa-scenarios`.
- The current workspace baseline is a green `pnpm test` and `pnpm typecheck`.
- A live OpenCode bridge probe is verified against local OpenCode `1.17.18` after the bridge server-manager ESM fix.
- Local simulator validation is partially blocked by host tooling: the repository now has a validated Android wrapper path that boots or reuses `ContextEngine_Test_Device`, builds, installs, and opens the dev client under JDK 17; plain `expo run:android` remains less reliable when Expo is responsible for starting the emulator itself. iOS simulator builds still fail on Xcode 16.4 because the resolved Swift package graph requires Swift tools `6.2.0` while Xcode 16.4 only provides Swift `6.1.x`.

Known QA-readiness gaps remain:

- Pairing and authenticated encryption are implemented but are not yet fully the default bridge startup path.
- Private-network routing still has documented stubs around network identification, latency correlation, and interface-to-IP resolution.
- Maestro and device validation, release packaging, and installer and start-on-login validation are still release-gate work.

## Recommended implementation stack

- Mobile: Expo SDK 56 + React Native 0.85 + TypeScript development builds
- Host bridge: Node.js 24 LTS + TypeScript
- Persistence: `better-sqlite3` on bridge and `expo-sqlite` on mobile
- Direct transport: paired application-encrypted WebSocket using UCP
- Remote private-network mode: Tailscale/WireGuard-compatible addressing
- Optional managed relay: outbound encrypted tunnels; content-blind routing
- Monorepo: pnpm with hoisted linking + Turborepo
- Mobile E2E: Maestro
- Distribution: platform installers bundle Node; no Node SEA dependency

## Read first

1. [Product Features and App Behavior](docs/product/PRODUCT_FEATURES_AND_APP_BEHAVIOR.md)
2. [Architecture](docs/architecture/ARCHITECTURE.md)
3. [Local-First Networking](docs/architecture/LOCAL_FIRST_NETWORKING.md)
4. [UCP Protocol](docs/architecture/UCP_PROTOCOL.md)
5. [Development Plan](docs/planning/DEVELOPMENT_PLAN.md)
6. [Multi-Agent Development Plan](docs/planning/MULTI_AGENT_DEVELOPMENT_PLAN.md)
7. [Security and Threat Model](docs/security/SECURITY_AND_THREAT_MODEL.md)

## Definition of the first usable release

A user can install a bridge, pair a phone without creating a product account, discover Codex and OpenCode, view sessions, send short instructions, answer structured approvals, cancel work, survive network changes, and recover state after a bridge restart. Codex and OpenCode are the only runtime adapters required or supported for the v1 release.

## Non-goals for the first release

- Full mobile IDE
- General-purpose terminal
- Remote desktop
- Arbitrary filesystem browser
- Automatic approval of high-risk actions
- Cloud-hosted agent execution
- Team administration

## License recommendation

Apache-2.0 for original project code, subject to a dependency and trademark review before publication.

## Implementation readiness and stack validation

Before coding, read:

1. [Tech Stack and Blocker Audit](docs/development/TECH_STACK_AND_BLOCKER_AUDIT.md)
2. [Development Environment](docs/development/DEVELOPMENT_ENVIRONMENT.md)
3. [Bootstrap Commands](docs/development/BOOTSTRAP_COMMANDS.md)
4. [Compatibility Matrix](docs/architecture/COMPATIBILITY_MATRIX.md)
5. [Dependency Policy](docs/development/DEPENDENCY_POLICY.md)
6. [CI/CD](docs/operations/CI_CD.md)
7. [Installation and User Onboarding](docs/product/INSTALLATION_AND_USER_ONBOARDING.md)
8. [Implementation Readiness Checklist](docs/planning/IMPLEMENTATION_READINESS_CHECKLIST.md)

The only unavoidable external requirements are platform/runtime prerequisites: macOS/Xcode for iOS builds, Android Studio plus JDK 17 for Android emulator builds, user-installed/authenticated coding runtimes, and optional server infrastructure for reliable background push. None blocks the LAN/private-network MVP, but current local simulator validation remains host-toolchain dependent.
