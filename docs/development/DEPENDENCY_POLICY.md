# Dependency Policy

## 1. Principles

- Prefer platform and Expo SDK packages before community native modules.
- Prefer pure TypeScript packages for shared mobile/Node code.
- Add native dependencies only behind an interface and after a proof spike.
- Pin major versions and commit the lockfile.
- Upgrade one foundational layer at a time.

## 2. Foundational dependency freeze

The following change only through a dedicated upgrade pull request:

- Node major
- Expo SDK
- React Native
- React
- pnpm
- TypeScript major
- `better-sqlite3` major
- Fastify major
- Claude Agent SDK major/minor with breaking changes
- Codex/OpenCode compatibility baseline

## 3. Native dependency rule

A new mobile native dependency requires:

- New Architecture compatibility check
- Expo config-plugin or CNG plan
- Android and iOS build proof
- license review
- maintenance/activity review
- physical-device smoke test
- removal/fallback plan

## 4. Workspace consistency

CI fails on duplicate incompatible copies of:

- `react`
- `react-native`
- `expo`
- Expo native modules
- shared protocol packages

## 5. Renovation strategy

Use Dependabot or Renovate with groups:

- mobile Expo-compatible updates
- bridge runtime updates
- dev/test tooling
- runtime SDKs
- security patches

Do not automatically merge runtime SDK or crypto updates.

## 6. Vulnerability response

- Critical remotely exploitable issue: patch release immediately.
- High issue on optional feature: disable with feature flag if patch unavailable.
- Native dependency issue: rebuild all affected platform artifacts.
- Runtime SDK issue: update compatibility matrix and disable unsafe capability.

## 7. Crypto dependencies

Cryptographic packages require:

- exact versions
- source/audit review
- known-answer tests
- cross-platform vectors
- no dynamic algorithm selection from untrusted input
- independent protocol review before public relay launch
