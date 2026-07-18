# Mobile Agent Status

Updated: 2026-07-19

## Completed

- MOB-001: Expo Router navigation scaffold (`_layout.tsx`, `index.tsx`, sessions list, session detail, approval screen, pairing screen placeholder)
- MOB-002: Zustand session store with reducer-style normalized event application (`session-store.ts`) and connection store (`connection-store.ts`)
- MOB-003: WebSocket connection state machine (`ucp-client.ts`) with exponential backoff reconnect (5 attempts, 1s/2s/4s/8s/16s)
- QA-001: Fake scenario engine with 3 scenarios (see packages/qa-scenarios)
- Shared UCP types (`src/types.ts`) for mobile-local normalized shapes
- Component tests for session-store (applyEvent, idempotency, markStale, snapshot)
- Component tests for UcpClient (connect, disconnect, inbound event dispatch, malformed frame handling)

## In progress

None

## Blocked

- `pnpm install` must be run before tests can execute (per task constraints, not run by this agent)
- Approval decision buttons wired to `approval.answer` command — deferred pending bridge command ledger (future task)
- Full pairing flow (QR camera + crypto handshake) — deferred to security/networking agent task
- Biometric gate for high-risk approvals — deferred to security agent task

## Paths

- `apps/mobile/**`
- `packages/qa-scenarios/**`

## Tests not run

- `pnpm --filter @agent-deck/mobile test` — pnpm install not executed
- `pnpm --filter @agent-deck/qa-scenarios test` — pnpm install not executed

## Key decisions

1. Shared `src/types.ts` owns all mobile-local UCP normalizations; screens import from there, never from bridge packages.
2. `applyEvent` uses version-gated merge; lower versions are silently dropped (UCP §15).
3. Approval cards stay after resolution (terminal state rendered, buttons disabled) per product spec §9.
4. Decision buttons disabled whenever `connectionStatus !== 'connected'` (invariant #9, #13).
5. `UcpClient` sends `connection.initialize` on `onopen`, not before — nothing is sent until the socket is open.
6. DISCONNECT/RECONNECT/COMMAND_SEND are sentinel types in scenario steps, consumed by the harness runner, not emitted to the store.
