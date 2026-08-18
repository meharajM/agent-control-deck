# Handoff: NET-001 Private-Network Mode and Route Selection

## Summary

Implemented route selection, route diagnostics, private endpoint configuration, and bridge interface binding for Phase 7 private-network mode.

## Files changed

### New files
- `apps/mobile/src/services/route-selection.ts` — Route selection algorithm with priority: memory → direct → private → none. 3-failure fallback threshold. Endpoint validation.
- `apps/mobile/src/services/route-diagnostics.ts` — DiagnosticsTracker class: latency P95, uptime, reconnect count, route type.
- `apps/mobile/src/app/(tabs)/diagnostics.tsx` — Diagnostics screen: route badge, latency (color-coded), uptime, reconnect count, P95 delivery, test connection button. VoiceOver labels on all values.
- `apps/mobile/src/app/(settings)/_layout.tsx` — Settings stack layout.
- `apps/mobile/src/app/(settings)/index.tsx` — Settings screen: private endpoint input (SecureStore), save/test/delete, auto-fallback toggle.
- `apps/mobile/src/__tests__/route-selection.test.ts` — 17 unit tests for route selection, fallback, and endpoint validation.

### Modified files
- `apps/mobile/src/store/connection-store.ts` — Added route state (routeType, routeMemory, directFailures, privateFailures, selectedRoute, autoFallbackEnabled, diagnostics) and actions (selectBestRoute, recordRouteSuccess, recordRouteFailure, setDiagnostics, etc.).
- `apps/mobile/src/services/bridge-connection.ts` — Added route awareness: calls selectRoute before connecting, records success/failure, starts diagnostics timer on connect, attempts fallback on disconnect.
- `apps/mobile/src/app/(tabs)/_layout.tsx` — Added Diagnostics and Settings tabs.
- `apps/mobile/src/app/_layout.tsx` — Registered (settings) route group.
- `apps/bridge/src/bridge-app.ts` — Added `interface` config field, `BRIDGE_INTERFACE` env var support, bind-to-interface logic, warning when binding to 0.0.0.0.
- `apps/bridge/src/ucp-gateway.ts` — Added `host` config for interface binding, `host.get_diagnostics` command handler returning bridge version, uptime, connected devices, active sessions, memory usage.

## Contracts used or changed

- `apps/mobile/src/services/route-selection.ts` — New `RouteConfig`, `RouteSelection`, `RouteType` types
- `apps/mobile/src/services/route-diagnostics.ts` — New `RouteDiagnostics`, `DiagnosticsTracker` types
- `apps/mobile/src/store/connection-store.ts` — Extended `ConnectionState` with route fields
- `apps/bridge/src/ucp-gateway.ts` — New `host.get_diagnostics` command type

## Tests run

```bash
pnpm install
cd apps/mobile && npx tsc --noEmit  # 1 pre-existing error (scan.tsx)
cd apps/mobile && npx vitest run     # 42/48 pass, 6 pre-existing failures
cd apps/mobile && npx vitest run src/__tests__/route-selection.test.ts  # 17/17 pass
cd apps/bridge && npx tsc --noEmit   # errors in pre-existing test file only
```

## Tests not run

- Bridge integration tests (require real SQLite + Node runtime)
- Maestro mobile E2E (require device/emulator)
- Security/networking tests (owned by SEC-001)

## Known limitations

- Network ID (Wi-Fi SSID) is stubbed — real impl needs React Native NetInfo for per-network route memory
- Latency tracking uses a placeholder — real impl needs correlationId-to-timestamp matching for accurate command.send→command.ack measurement
- Bridge interface name resolution (en0 → IP) is stubbed — needs `os.networkInterfaces()` in production
- Diagnostics tab always shown (not hidden when disconnected) due to expo-router `exactOptionalPropertyTypes` strictness
- Private endpoint test button only validates format, doesn't actually attempt WebSocket connection

## Security/privacy impact

- Private endpoint stored in expo-secure-store (not plain AsyncStorage)
- Endpoint validation rejects localhost/loopback (cannot bypass direct route)
- Endpoint validation rejects 0.0.0.0
- Bridge warns when binding to 0.0.0.0 without auth
- Diagnostics endpoint only responds to authenticated connections
- No internal IPs exposed in user-facing error messages

## Accessibility impact

- Diagnostics screen: VoiceOver/TalkBack labels on latency ("Latency: 42 milliseconds"), uptime, route type badge
- Settings screen: accessibility labels on all inputs and buttons
- 48x48 minimum touch targets on all controls
- Color-coded latency (green/yellow/red) paired with text values

## Follow-up tasks

- NET-002: Implement real network ID detection (React Native NetInfo)
- NET-003: Implement real latency measurement with correlationId tracking
- NET-004: Bridge interface name → IP resolution via os.networkInterfaces()
- SEC-001: Pairing-based auth for private routes (already in progress)
- QA: Route fallback integration tests with mock WebSocket failures

## Suggested reviewer

Security/networking agent for endpoint validation and bridge binding safety

## Reviewer note (2026-07-21)

This handoff captures intermediate task-level validation, not the current repository-wide baseline. The workspace now has a green `pnpm test` and `pnpm typecheck`, but the documented implementation stubs in this handoff still remain open QA-readiness items.
