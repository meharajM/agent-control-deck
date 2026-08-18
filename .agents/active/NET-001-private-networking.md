# Task: NET-001 Private-Network Mode and Route Selection

## Owner role

security/networking

## Goal

Implement private-network endpoint mode (Tailscale/WireGuard), route selection logic, route diagnostics, and direct/private fallback for remote operation without a managed relay.

## Background

Phase 7 enables remote access via private overlay networks. The architecture (docs/architecture/LOCAL_FIRST_NETWORKING.md) defines Mode B: private overlay network using Tailscale/WireGuard. The phone stores a configured private endpoint and connects with the same UCP authentication used on LAN. This task adds:

- Manual private endpoint configuration on mobile
- Route selection: direct LAN → discovered LAN → configured private → (optional relay later)
- Route diagnostics screen showing current route, latency, connection quality
- Automatic fallback from direct to private when direct fails
- Persistent route memory (last successful route per network)
- Bridge binding configuration for private network interfaces

## Dependencies

- Pairing and encrypted transport (SEC-001) — MUST BE IN PROGRESS OR DONE
- UCP protocol (UCP-001–003) — DONE
- Mobile stores and services (MOB-001–008) — DONE
- Bridge app (BRG-001–007) — DONE

## Contracts consumed

- `packages/protocol/src/types.ts` — branded IDs
- `apps/mobile/src/services/bridge-connection.ts` — connection state machine
- `apps/mobile/src/services/ucp-client.ts` — WebSocket client
- `apps/mobile/src/store/connection-store.ts` — connection state
- `apps/bridge/src/ucp-gateway.ts` — WebSocket server
- `apps/bridge/src/bridge-app.ts` — bridge configuration
- `docs/architecture/LOCAL_FIRST_NETWORKING.md` — route selection spec

## Allowed paths

- `apps/mobile/src/**` (route selection UI, diagnostics screen, endpoint config)
- `apps/bridge/src/**` (bridge binding config, interface detection)
- `apps/mobile/src/store/**` (route state, diagnostics state)
- `apps/mobile/src/app/**` (diagnostics screen, settings screen)
- `packages/protocol/src/**` (route/diagnostics message types if needed)
- `db/migrations/**` (route memory table if needed)

## Forbidden paths

- `packages/adapter-*/**` — no adapter changes
- `packages/bridge-core/**` — no core service changes
- `packages/bridge-database/**` — no database package changes
- `packages/qa-scenarios/**` — QA owns tests separately
- `packages/crypto/**` — crypto owned by SEC-001

## Acceptance criteria

- [ ] Mobile settings screen: add/edit/delete private network endpoint (host:port format)
- [ ] Route selection logic: tries direct LAN first, falls back to private endpoint, shows selected route
- [ ] Route persistence: last successful route remembered per network SSID/identifier
- [ ] Route diagnostics screen: shows current route type (direct/private/relay), latency (ms), connection uptime, last reconnect reason
- [ ] Bridge can bind to specific network interface via config (BRIDGE_INTERFACE env var or config)
- [ ] Bridge warns if binding to 0.0.0.0 without authenticated transport
- [ ] Direct → private fallback: when direct connection fails 3x, automatically try private endpoint
- [ ] Private endpoint connection uses same UCP authentication as LAN (pairing-based)
- [ ] Route transition events broadcast to mobile (host.status_changed with route info)
- [ ] Diagnostics accessible from mobile via host.get_diagnostics command
- [ ] No DNS rebinding: private endpoint validated against pinned host identity
- [ ] Connection quality metrics: ping latency, message delivery time, reconnect count

## Required tests

- Unit: route selection priority logic (direct > private > relay)
- Unit: route persistence (save/load last successful route)
- Unit: fallback threshold (3 failures before switch)
- Unit: endpoint validation (host:port format, no DNS rebinding)
- Integration: direct connection succeeds → route stays direct
- Integration: direct fails 3x → fallback to private endpoint
- Integration: private endpoint connection with UCP auth handshake
- Integration: diagnostics report accurate route, latency, uptime
- Integration: bridge interface binding (specific interface vs 0.0.0.0)
- Property: route transitions are logged to audit_events
- Property: no unauthenticated endpoint exposed

## Security/privacy considerations

- Private endpoint uses same pairing-based auth as LAN — no separate auth
- Endpoint configuration stored in mobile secure store (not plain AsyncStorage)
- Bridge interface binding prevents accidental public exposure
- Route diagnostics do not expose internal IP addresses to unauthorized viewers
- DNS rebinding protection: validate host identity on private routes

## Accessibility considerations

- Route diagnostics screen: clear text labels for route type, latency, status
- VoiceOver/TalkBack: "Current route: Direct LAN, Latency: 42 milliseconds"
- Connection state changes announced via AccessibilityInfo
- Large touch targets for endpoint configuration controls

## Handoff recipient

QA/chaos/accessibility agent for networking tests, then release/packaging for installer updates
