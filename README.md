# Agent Deck

A local-first, server-optional mobile command surface for controlling AI coding agents running on a user's own computer.

## Supported runtimes

- OpenAI Codex
- OpenCode
- Claude Code through bridge-managed Claude Agent SDK sessions

OpenClaw is intentionally outside the scope of this repository plan.

## Problem statement

Coding agents increasingly run for long periods and frequently need small but important human decisions: approve a command, reject a risky change, answer a question, change direction, raise or lower reasoning effort, or stop a failing task. Existing interfaces are runtime-specific and often expose far more context than a phone user needs.

Agent Deck provides one low-context mobile interface that answers four questions:

1. What is the agent doing?
2. Does it need the user?
3. What decision is required?
4. What will happen after that decision?

## Local-first promise

The base product works without a vendor-operated cloud server.

```text
Mobile app -- local Wi-Fi/private network --> Host bridge --> Coding runtimes
```

The host bridge is required and runs on the user's machine. A managed relay is optional and may be added later for frictionless remote connectivity and push notifications. LAN and private-network operation remain functional when all optional hosted services are unavailable.

## Repository blueprint

This package is a development-planning and bootstrap bundle. It contains:

- Product requirements and app behavior
- Architecture and local-first networking decisions
- Universal Control Protocol specification
- Runtime adapter contracts
- Security and threat model
- Data model and starter SQL migration
- Multi-agent development workflow
- Testing, accessibility, observability, release, and roadmap plans
- ADRs, task templates, handoff templates, and specialist-agent prompts
- Starter JSON Schemas and configuration examples

It does not yet contain the completed mobile app or host bridge implementation.

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

A user can install a bridge, pair a phone without creating a product account, discover Codex and OpenCode, view sessions, send short instructions, answer structured approvals, cancel work, survive network changes, and recover state after a bridge restart. Claude bridge-managed sessions may ship as beta.

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

The only unavoidable external requirements are platform/runtime prerequisites: macOS/Xcode for iOS builds, user-installed/authenticated coding runtimes, and optional server infrastructure for reliable background push. None blocks the LAN/private-network MVP.
