# Handoff: CODEX-001 Codex app-server v2 compatibility

## Summary

Updated the Codex adapter from the rejected legacy `threads/*` and `turns/*` methods to the current Codex CLI 0.145.0 thread/turn API. Added current notification normalization and verified real session and instruction lifecycles through the adapter and bridge UCP path.

## Files changed

- `.agents/active/CODEX-001-live-app-server-v2.md`
- `packages/adapter-codex/src/codex-client.ts`
- `packages/adapter-codex/src/codex-adapter.ts`
- `packages/adapter-codex/src/normalization/event-normalizer.ts`
- `packages/adapter-codex/src/__tests__/event-normalizer.test.ts`
- `packages/adapter-opencode/src/normalization/event-normalizer.ts`
- `packages/adapter-opencode/src/opencode-adapter.ts`
- `packages/adapter-opencode/src/__tests__/event-normalizer.test.ts`
- `docs/architecture/SOURCE_NOTES.md`
- `docs/architecture/COMPATIBILITY_MATRIX.md`

## Contracts used or changed

- Current Codex app-server JSON-RPC v2 methods: `thread/start`, `thread/read`, `turn/start`, and `turn/interrupt`.
- Existing `RuntimeAdapter` and UCP bridge contracts were preserved.
- OpenCode 1.17.18 legacy SSE `session.next.step.ended` was normalized as the terminal completion event.

## Tests run

- `pnpm --filter @agent-deck/adapter-codex typecheck` — pass
- `pnpm --filter @agent-deck/adapter-codex test` — 4 files, 29 tests pass
- `pnpm --filter @agent-deck/adapter-opencode typecheck` — pass
- `pnpm --filter @agent-deck/adapter-opencode test` — 5 files, 72 tests pass
- `pnpm --filter @agent-deck/bridge test` — 5 files, 40 tests pass
- `pnpm build` — 12 packages pass
- `pnpm typecheck` — 13 packages pass
- `git diff --check` — pass
- Real Codex CLI `0.145.0`: probe, thread start/read, bridge UCP start/ack, and non-mutating turn completion — pass
- Real OpenCode `1.17.18`: probe, bridge UCP start/cancel, non-mutating prompt streaming/completion, and reconcile — pass
- iOS simulator `com.agentdeck.mobile`: installed and launched on `AgentDeck iPhone 16 (iOS 26.5)`; Metro on port 8081 — pass

## Tests not run

- Full secure pairing through simulator UI — simulator is left at the pairing screen and a secure bridge is running for manual pairing.
- Maestro iOS flow — not available in the current tool context.
- Physical-device install — requires Apple development signing/team.
- Provider-specific destructive actions, approvals, and file-edit turns — intentionally not exercised.

## Known limitations

- Claude Code CLI is installed locally but remains post-v1; the bridge runtime selector intentionally supports only `fake`, `codex`, and `opencode`.
- The live OpenCode bridge uses loopback and a temporary pairing code for this local simulator session.

## Security/privacy impact

No provider credentials were moved or logged. Runtime prompts used explicit no-file-modification instructions. The bridge was bound to `127.0.0.1`; its persistent smoke database is in `/tmp`.

## Accessibility impact

None. No mobile UI behavior changed in this validation task.

## Follow-up tasks

1. Pair the running simulator manually with the displayed bridge code and exercise the session list/send/cancel controls.
2. Add a device-driven Maestro flow for pairing and a non-mutating session turn.

## Suggested reviewer

Codex adapter owner, OpenCode adapter owner, bridge owner, and QA.
