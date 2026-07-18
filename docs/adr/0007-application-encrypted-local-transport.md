# ADR 0007: Application-Encrypted Local Transport

## Status

Accepted.

## Decision

Use local/private `ws://` WebSocket transport with paired application-layer authentication and authenticated encryption for every UCP frame. Use normal `wss://` for relay/public endpoints while retaining UCP frame encryption.

## Reason

Self-signed local TLS and portable WebSocket certificate pinning would require fragile native work in the first release. Application encryption provides one end-to-end security model across direct and relay routes.

## Consequences

- iOS local-network/ATS configuration is required.
- Android local cleartext transport must be explicitly configured.
- Unencrypted application frames are invalid.
- Crypto construction requires review before production.
