# Task: OSS-001 Open-source release and one-time host setup

## Owner role

Coordinator / release integration

## Goal

Make Agent Deck easy to discover and run from an open-source checkout, provide a one-time `setup.sh` host bootstrap, keep OpenCode sessions visible after bridge/app restarts, build Android and iOS artifacts, and publish a version tag.

## Background

The repository has working bridge and mobile foundations but user-facing setup is split across historical quickstarts. OpenCode is currently managed only when the bridge creates a session. A persistent host setup needs a shared OpenCode server and adapter discovery so normal OpenCode attach sessions appear in the mobile snapshot.

## Dependencies

- Existing secure pairing and UCP gateway
- OpenCode HTTP/SSE server API
- Current Expo SDK 56 native projects

## Contracts consumed

- RuntimeAdapter and AdapterEvent
- OpenCode server `/global/health`, `/api/session`, and `/api/event` APIs
- Existing UCP session snapshot/event behavior

## Allowed paths

- `packages/adapter-opencode/**`
- `apps/bridge/**`
- `scripts/**`
- `setup.sh`
- `README.md`
- `RUNNING.md`
- `setup.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `CHANGELOG.md`
- `.github/**`
- `docs/product/USER_GUIDE.md`
- `docs/product/INSTALLATION_AND_USER_ONBOARDING.md`
- `docs/operations/RELEASE_AND_DEPLOYMENT.md`
- `docs/development/DEVELOPMENT_ENVIRONMENT.md`
- `.agents/active/OSS-001-open-source-release-setup.md`
- `.agents/handoffs/OSS-001-open-source-release-setup.md`

## Forbidden paths

- `schemas/**`
- `db/migrations/**`
- `packages/protocol/**`
- `packages/crypto/**`
- `apps/mobile/src/**` unless a build blocker proves it necessary
- Real credentials, provider tokens, or private runtime data

## Acceptance criteria

- [x] One-time setup asks no more than three questions and writes host-only configuration with restrictive permissions.
- [x] macOS start-on-login path starts OpenCode server and bridge; Linux user-service instructions are documented.
- [x] OpenCode adapter can attach to configured persistent server, discover existing sessions, and poll for sessions created after startup.
- [x] Bridge restart and mobile snapshot retain discovered session identity/state.
- [x] README and public repository metadata clearly explain scope, install, security, support, and contribution paths.
- [x] Android debug artifact and iOS device/simulator artifact build successfully on the current host.
- [x] CI and tag release workflows are reproducible and do not contain secrets.
- [x] Version tag is pushed to the configured origin after validation.

## Required tests

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- OpenCode adapter attach/discovery tests
- Android build/install smoke test
- iOS build/install smoke test where signing/toolchain permits

## Security/privacy considerations

OpenCode credentials remain in a user-only host config file and are never sent to mobile or committed. Persistent OpenCode server binds to loopback; only the Agent Deck bridge binds to the selected private address.

## Accessibility considerations

No mobile UI changes are planned. Setup docs must describe text/manual pairing and avoid voice- or gesture-only requirements.

## Handoff recipient

Repository maintainers and release reviewer
