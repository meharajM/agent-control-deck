# Local-First Networking and Optional Server Design

## 1. Decision

Agent Deck is local-first and server optional.

A small host bridge is mandatory because it owns runtime integrations, persistence, and pairing. A vendor cloud server is not mandatory.

## 2. Connectivity modes

### Mode A: direct LAN

```text
Phone -- Wi-Fi/Ethernet LAN --> Host bridge
```

Use for MVP and normal same-network operation.

Requirements:

- Pairing-authenticated, application-encrypted UCP channel
- Pairing-based host identity pinning
- Explicit listening interface configuration
- Optional mDNS discovery
- Manual IP/hostname fallback

### Mode B: private overlay network

```text
Phone -- Tailscale/WireGuard --> Host bridge
```

Recommended remote mode before building a managed relay.

The app stores a configured private endpoint and connects with the same UCP authentication used on LAN. The bridge does not need to know the user's Tailscale credentials.

### Mode C: optional managed relay

```text
Phone -- outbound WSS --> Relay <-- outbound WSS -- Host bridge
```

Used for zero-network-configuration remote access and push signaling.

### Mode D: self-hosted relay

Same protocol and container image as managed relay, deployed by the user or organization.

## 3. Route selection

Preferred order:

1. Previously successful direct endpoint on current network
2. Discovered LAN endpoint
3. Configured private-network endpoint
4. Optional relay

The app displays the selected route.

Do not silently downgrade from a pinned authenticated route to an unauthenticated endpoint.

## 4. LAN discovery

Discovery may use mDNS to advertise a service such as:

```text
_agent-deck._tcp.local
```

Advertise only:

- Host ID hash
- Friendly name
- Port
- Protocol version range

Do not advertise project names, runtime credentials, or session data.

Discovery is convenience only. Authentication still requires a valid device grant.

## 5. Listening interfaces

Safe defaults:

- During initial setup: localhost only
- After explicit LAN enablement: selected private interfaces
- Never default to `0.0.0.0` without authenticated transport and a clear user confirmation

The bridge should detect public interfaces and warn before binding.

## 6. Direct transport and identity

Pairing establishes a long-term host identity. The mobile app pins that identity. For local/private endpoints, use WebSocket transport with an application handshake and authenticated encryption for every UCP frame. This avoids depending on a self-signed TLS trust or WebSocket pinning module. Relay/public endpoints use normal `wss://` in addition to UCP frame encryption.

Required properties:

- Host and device identity keys
- One-time pairing secret/challenge
- Connection-specific ephemeral keys
- Directional keys and sequence counters
- Replay rejection
- Identity/key rotation with continuity proof

Use reviewed libraries and publish test vectors. Do not design new cryptographic primitives.

## 7. Pairing

### Pairing code contents

- Protocol version
- Host ID
- Friendly host name
- Host public identity
- One-time nonce
- Direct endpoints
- Optional relay endpoint
- Expiry

### Pairing properties

- Five-minute expiry by default
- One-time nonce
- Human-readable fingerprint confirmation
- Device identity generated on phone
- Per-device grant
- Immediate revocation support

## 8. No-account behavior

LAN and private-network modes require no Agent Deck account.

The bridge is the authority for:

- Paired devices
- Device names
- Grants
- Revocation
- Host preferences

A product account, if added, is used only for optional relay discovery, subscription, and push routing.

## 9. Optional relay responsibilities

Allowed:

- Verify relay routing grants
- Track connection presence
- Route opaque encrypted frames
- Rate limit abuse
- Trigger generic APNs/FCM notifications
- Store short-lived encrypted notification envelopes

Not allowed:

- Runtime login
- Source access
- Prompt decryption
- Command execution
- Approval decisions
- Canonical session state

## 10. End-to-end relay encryption

The phone and bridge establish session keys. The relay sees:

- Host/device routing identifiers
- Frame size
- Timing
- Expiry
- Ciphertext

It does not see the UCP message type or payload.

## 11. Background behavior

Mobile operating systems may suspend foreground sockets.

Without optional server/push:

- The app reconnects when foregrounded.
- No reliable remote background alert is promised.
- Local notifications can be generated only while the app/connection is active.

With optional push gateway:

- Bridge creates generic attention event.
- Relay/push service sends opaque notification.
- App reconnects and retrieves encrypted detail.

## 12. Failure modes

### Direct route fails

Try private and relay routes. Show route transition in diagnostics, not as disruptive UI unless all routes fail.

### Relay fails

Continue agent execution and local journaling. Attempt direct/private routes. Do not lose session state.

### Split routing

Two devices may connect by different routes. The bridge remains the single command arbiter.

### Host sleeps

Phone shows cached state as stale. Drafts are allowed; state-changing actions are disabled.

### NAT or IP changes

Discovery/private-route retry triggers a full authenticated reconnect and state synchronization.

## 13. Security controls

- Origin validation for any browser-accessible HTTP endpoints
- Device authentication on every UCP connection
- Replay-protected handshake
- Per-device revocation
- Connection and frame size limits
- Authentication failure rate limiting
- No unauthenticated diagnostics endpoint on a network interface
- Local admin UI protected against DNS rebinding and CSRF

## 14. Implementation stages

### Stage 1

- Loopback development
- Manual LAN IP
- One-time pairing-code entry
- Direct application-encrypted WebSocket

### Stage 2

- Bonjour/mDNS discovery for `_agent-deck._tcp` on Android and iOS
- Interface selection
- Tailscale endpoint support
- Route selection UI

The mobile app uses a four-digit, one-time code to authorize the discovered host. The code is not used as the transport key; the existing device-key handshake and authenticated UCP session remain authoritative. Android emulators may require the manual development endpoint because multicast discovery is not reliable in emulator networking.

### Stage 3

- Optional relay client and service
- Generic push notifications
- Self-hosted deployment guide

## 15. Acceptance criteria

- Core app works with all vendor services disabled.
- LAN pairing and reconnection complete without an account.
- Private-network mode works without relay code.
- Relay outage never causes runtime session loss.
- Relay cannot decrypt captured frames in security testing.
