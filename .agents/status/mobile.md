# Mobile Agent Status

Updated: 2026-07-21

## Completed

- Expo Router mobile shell now includes attention and session flows, approval screens, pairing routes, diagnostics, settings, and session detail screens
- Zustand session and connection stores implement normalized event application, reconnect and stale handling, pairing state, and route-selection state
- `ucp-client.ts` implements connection lifecycle plus the current handshake and encrypted-frame integration work
- Pairing, command-sending, biometric-gating hooks, route selection, and diagnostics services are present in-repo
- Mobile code participates in the current green workspace baseline

## In progress

- Physical-device QR and pairing validation evidence
- Maestro cross-platform approval and reconnect evidence
- Finishing private-route stubs for network ID detection and latency correlation

## Blocked

- iOS and device validation depend on Xcode 26.6+ toolchain availability
- Release-gate validation is still open even though core mobile flows are implemented

## Paths

- `apps/mobile/**`
- `packages/qa-scenarios/**`

## Key decisions

1. Shared `src/types.ts` owns all mobile-local UCP normalizations; screens import from there, never from bridge packages.
2. `applyEvent` uses version-gated merge; lower versions are silently dropped (UCP §15).
3. Approval cards stay after resolution (terminal state rendered, buttons disabled) per product spec §9.
4. Decision buttons disabled whenever `connectionStatus !== 'connected'` (invariant #9, #13).
5. `UcpClient` sends `connection.initialize` on `onopen`, not before — nothing is sent until the socket is open.
6. Route selection prefers remembered-good endpoints, then direct, then private endpoint fallback.
7. Text-first input remains the v1 path; dedicated push-to-talk is still post-v1 QA scope.
