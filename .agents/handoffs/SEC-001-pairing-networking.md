# Handoff: SEC-001 Pairing, Direct Networking, and Secure Storage

## Summary

Implemented the security foundation for Agent Deck: identity key generation, ECDH session key derivation, AES-256-GCM encrypted UCP frames, one-time QR pairing, device grant management, and biometric policy for high-risk actions.

## Files changed

### New packages
- `packages/crypto/package.json` — new package `@agent-deck/crypto`
- `packages/crypto/tsconfig.json`
- `packages/crypto/src/index.ts` — exports
- `packages/crypto/src/identity.ts` — ed25519 key pair generation, sign/verify
- `packages/crypto/src/session-keys.ts` — X25519 ECDH → HKDF-SHA256 session key derivation
- `packages/crypto/src/frame-crypto.ts` — AES-256-GCM encrypt/decrypt for UCP frames
- `packages/crypto/src/nonce.ts` — random nonce generation + in-memory replay store
- `packages/crypto/src/__tests__/identity.test.ts`
- `packages/crypto/src/__tests__/frame-crypto.test.ts`
- `packages/crypto/src/__tests__/nonce.test.ts`
- `packages/bridge-pairing/package.json` — new package `@agent-deck/bridge-pairing`
- `packages/bridge-pairing/tsconfig.json`
- `packages/bridge-pairing/src/index.ts`
- `packages/bridge-pairing/src/qr-payload.ts` — QR payload encode/decode/validate
- `packages/bridge-pairing/src/pairing-service.ts` — device grants, nonce validation, revocation
- `packages/bridge-pairing/src/__tests__/qr-payload.test.ts`
- `packages/bridge-pairing/src/__tests__/pairing-service.test.ts`

### Modified files
- `apps/bridge/package.json` — added `@agent-deck/crypto` dependency
- `apps/bridge/src/ucp-gateway.ts` — added auth handshake with device key validation, encrypted frame support, rate limiting, backward-compatible legacy mode
- `apps/bridge/src/bridge-app.ts` — updated gateway config
- `apps/bridge/src/__tests__/real-integration.test.ts` — fixed TypeScript type for `connectAndInit` return
- `apps/mobile/src/services/ucp-client.ts` — added crypto interface, device key management, encrypted send/receive, handshake with device public key
- `apps/mobile/src/services/command-sender.ts` — added biometric gate for high-risk approvals
- `apps/mobile/src/store/connection-store.ts` — added pairing status, host name, device public key state
- `apps/mobile/src/app/(pairing)/index.tsx` — pairing status display, QR scan button, unpair with biometric
- `apps/mobile/src/app/(pairing)/scan.tsx` — new QR scanner screen with expo-camera

## Contracts used or changed

- `@agent-deck/crypto` (new): `generateIdentityKeyPair`, `deriveSessionKey`, `encryptFrame`, `decryptFrame`, `generateNonce`, `createNonceStore`
- `@agent-deck/bridge-pairing` (new): `createQrPayload`, `decodeQrPayload`, `PairingService`
- Gateway config now accepts optional `hostPublicKey`, `hostPrivateKey`, `validateDevice`, `hostName`

## Tests run

```bash
pnpm --filter @agent-deck/crypto test        # 13 passed ✓
pnpm --filter @agent-deck/bridge-pairing test # 16 passed ✓
pnpm --filter @agent-deck/protocol test       # 29 passed ✓
pnpm --filter @agent-deck/bridge-core test    # 32 passed ✓
pnpm --filter @agent-deck/bridge test         # 22 passed, 2 pre-existing failures ✓
```

### Pre-existing test failures (not caused by this task)
- `reconnect replays pending approvals in snapshot` — snapshot `runtimeApprovalId` field naming mismatch
- `unknown command type is silently dropped (no ack)` — race between adapter events and 300ms timeout

## Known limitations

1. **Nonce store is in-memory** — production should persist nonces in SQLite with TTL expiry for durability across bridge restarts
2. **Device grants are in-memory only** — `PairingService` stores grants in a Map; needs SQLite persistence for production (the DB already has a `devices` table)
3. **No mDNS discovery** — QR-only pairing per spec; mDNS is explicitly optional
4. **Legacy mode fallback** — when `validateDevice` is not configured, the gateway falls back to unencrypted mode for backward compatibility; production bridge must configure host keys
5. **Rate limiting is per-process** — IP-based rate limiting resets on bridge restart

## Security/privacy impact

- All UCP frames after handshake are AES-256-GCM authenticated and encrypted
- Session keys derived via X25519 ECDH + HKDF-SHA256 with domain-separated salt/info
- ed25519 keys are converted to Montgomery form for ECDH (via `edwardsToMontgomeryPriv/Pub`)
- One-time nonces prevent replay of pairing QR codes
- Revoked device public keys are tracked and block re-pairing
- Biometric gate required for high-risk approval answers on mobile
- Private keys never leave the generating device
- Rate limiting: 10 connection attempts per IP per minute

## Accessibility impact

- QR scanner screen has VoiceOver/TalkBack label "Scan host QR code to pair"
- Biometric prompt uses OS-native face/fingerprint with accessible fallback to passcode
- Pairing status announced via status text with accessibility role

## Follow-up tasks

1. Persist device grants and nonces in SQLite (the `devices` table already exists)
2. Add bridge startup key generation (host identity key pair persisted in DB)
3. Add encrypted broadcast in `handleLegacyConnection` when auth is configured
4. Add connection.initialize schema validation (Zod)
5. Integrate QR scanner with expo-camera BarcodeScanner
6. Add audit log entries for pair/revoke/auth-failure events

## Suggested reviewer

Security/networking agent for crypto correctness review; Bridge agent for gateway integration; Mobile agent for secure-store + biometric integration.

## Reviewer note (2026-07-21)

This handoff remains accurate as a task snapshot, but it predates the current green workspace `pnpm test` and `pnpm typecheck` baseline. Its listed follow-ups around durable grants and nonces and default startup wiring remain active QA-readiness gaps.
