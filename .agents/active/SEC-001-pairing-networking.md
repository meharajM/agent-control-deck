# Task: SEC-001 Pairing, Direct Networking, and Secure Storage

## Owner role

security/networking

## Goal

Implement one-time QR pairing, host/device identity, direct application-encrypted WebSocket transport, device revocation, secure mobile key storage, and biometric policy for MVP LAN operation.

## Background

Phase 5 delivers the security foundation for Agent Deck. Without pairing and encrypted transport, the bridge is an unauthenticated control surface. The current UcpGateway accepts any WebSocket connection without authentication. This task adds:

- Long-term host identity key pair
- Per-device identity key pair (generated on phone)
- One-time QR pairing with nonce and expiry
- Application-layer encrypted and authenticated UCP frames
- Device grant/persistence in SQLite
- Device revocation (active disconnect + reconnect rejection)
- Secure key storage on mobile (expo-secure-store)
- Biometric gate for high-risk actions

## Dependencies

- UCP protocol schemas and types (UCP-001–003) — DONE
- Bridge database with devices table (DB-001) — DONE
- Bridge core services (BRG-001–007) — DONE
- Mobile stores and services (MOB-001–008) — DONE
- UCP WebSocket gateway (BRG-007) — DONE

## Contracts consumed

- `packages/protocol/src/types.ts` — branded IDs
- `packages/protocol/src/validate.ts` — UcpEnvelopeSchema
- `packages/bridge-database/src/database.ts` — SQLite with WAL
- `packages/bridge-core/src/index.ts` — EventJournal, CommandLedger
- `db/migrations/001_initial.sql` — devices table schema
- `apps/bridge/src/ucp-gateway.ts` — current unauthenticated gateway
- `apps/mobile/src/services/ucp-client.ts` — current mobile WebSocket client

## Allowed paths

- `packages/crypto/**` (new package for identity key generation)
- `packages/bridge-pairing/**` (new package for pairing logic)
- `apps/bridge/src/**` (gateway authentication handshake)
- `apps/mobile/src/**` (secure store, biometric, pairing flow)
- `db/migrations/**` (new migration for pairing state if needed)
- `packages/protocol/src/**` (new message types for handshake)
- `schemas/**` (new handshake envelope schemas)

## Forbidden paths

- `packages/adapter-*/**` — no adapter changes
- `packages/bridge-core/**` — no changes to existing core services
- `packages/qa-scenarios/**` — QA owns test scenarios separately
- `packages/bridge-database/**` — no changes to database package itself

## Acceptance criteria

- [ ] Host generates ed25519 identity key pair on startup, persists to bridge DB
- [ ] QR code contains: protocol version, host ID, host name, host public key, one-time nonce, direct endpoints, expiry (5 min)
- [ ] Phone generates ed25519 device key pair, stores private key in expo-secure-store
- [ ] Phone scans QR, derives shared secret, sends connection.initialize with device public key
- [ ] Bridge verifies nonce, validates device grant, establishes encrypted session
- [ ] All UCP frames after handshake are authenticated and encrypted (AES-256-GCM with per-session keys derived from ECDH)
- [ ] Unauthenticated WebSocket connections are rejected after handshake timeout
- [ ] Device revocation: revoke command closes active connection, rejected on reconnect
- [ ] Device list and revoke commands work end-to-end
- [ ] Biometric prompt required for high-risk approval answers and device revocation on mobile
- [ ] Replay protection: sequence counters, nonce reuse detection
- [ ] Frame size limits enforced (1 MiB JSON, 64 KiB binary)
- [ ] Origin validation for any browser-accessible endpoints
- [ ] No runtime credentials, prompts, or source code in any handshake/pairing frame

## Required tests

- Unit: key generation, nonce generation, shared secret derivation, frame encryption/decryption
- Unit: QR payload encoding/decoding, expiry validation, nonce single-use enforcement
- Unit: device grant storage, revocation persistence, reconnect rejection
- Unit: replay detection (same nonce, same sequence)
- Integration: full pairing flow (bridge generates QR, phone scans, handshake completes)
- Integration: encrypted frame round-trip (encrypt on phone, decrypt on bridge, verify integrity)
- Integration: revoked device reconnect fails with DEVICE_REVOKED error
- Integration: expired QR rejected
- Integration: biometric gate blocks high-risk action without biometric
- Property: decryption fails on tampered ciphertext (bit flip)
- Property: decryption fails on wrong session key

## Security/privacy considerations

- Use audited libs ( tweetnacl / @noble/ed25519 for keys, @noble/ciphers for AES-GCM). Do NOT implement custom crypto.
- Private keys never leave the device that generated them
- Nonces are single-use and stored in DB to prevent replay
- Pairing QR expires in 5 minutes
- Revoked device public keys are kept to reject re-pairing with same identity
- All handshake frames are rate-limited (max 10 attempts per IP per minute)
- Audit log entries for: pair success, pair failure, revoke, auth failure

## Accessibility considerations

- QR scanning uses expo-camera with VoiceOver/TalkBack label "Scan host QR code to pair"
- Biometric prompt uses OS-native face/fingerprint with accessible fallback to passcode
- Pairing success/failure announced via AccessibilityInfo

## Handoff recipient

QA/chaos/accessibility agent for security testing gate
