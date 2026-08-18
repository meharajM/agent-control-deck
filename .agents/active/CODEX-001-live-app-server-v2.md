# Task: CODEX-001 Codex app-server v2 compatibility

Status: complete

## Owner role

Codex adapter and QA validation.

## Goal

Update the Codex adapter to the current `codex app-server` thread/turn API and prove a real local Codex session lifecycle from the bridge path.

## Background

The installed Codex CLI 0.145.0 accepts `initialize` and `thread/start`, but rejects the adapter's legacy `threads/create` request. The current bridge cannot start a Codex session until the adapter uses the v2 method names and response shapes.

## Dependencies

- Existing Codex adapter contract
- Current Codex app-server documentation and local Codex CLI 0.145.0
- Existing bridge runtime smoke path

## Allowed paths

- `packages/adapter-codex/**`
- `.agents/active/CODEX-001-live-app-server-v2.md`
- `.agents/handoffs/CODEX-001-live-app-server-v2.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`
- `docs/architecture/SOURCE_NOTES.md`

## Forbidden paths

- Mobile UI and native build files
- UCP schemas and crypto/pairing contracts
- Database migrations

## Acceptance criteria

- [x] `thread/start` creates a real local Codex thread.
- [x] `thread/read` reconciles a real thread.
- [x] `turn/start` is used for instructions and maps the returned turn ID.
- [x] `turn/interrupt` is used when an active turn can be cancelled.
- [x] Existing adapter tests and typecheck pass.
- [x] A real Codex probe and no-instruction start/reconcile smoke pass.

## Security/privacy considerations

Use only local app-server transport. Do not include credentials or prompt contents in logs or fixtures. The smoke test must not start a model turn unless explicitly required.

## Handoff recipient

Coordinator and QA reviewers.
