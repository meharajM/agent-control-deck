# Release and Deployment

## 1. Release channels

- Development
- Nightly
- Beta
- Stable

Runtime adapters may have independent compatibility releases while sharing the bridge version.

## 2. Bridge distribution

Targets:

- macOS universal installer/package
- Windows signed installer
- Linux packages and standalone archive

Packaging decision:

- Bundle the official Node 24 runtime and target-specific native dependencies.
- Do not require a system Node installation.
- Do not use Node SEA for v1.
- Run in the signed-in user context.

Requirements:

- Signed artifacts
- Checksums
- SBOM
- Automatic update opt-in
- Start-on-login option
- Rollback support

## 3. Mobile distribution

- Internal development builds
- TestFlight
- Google Play internal testing
- Public beta
- Stable store release

## 4. No-server deployment

Document:

- LAN-only installation
- Firewall rule
- QR pairing
- Tailscale/private endpoint
- Complete disablement of optional hosted services

## 5. Optional relay deployment

Provide:

- Container image
- Helm chart or simple Compose deployment
- Stateless WebSocket gateway design
- External presence/rate-limit store only when required
- APNs/FCM secret handling
- Regional configuration
- Health and readiness probes

## 6. Compatibility release process

For each runtime release:

1. Detect change in scheduled CI.
2. Run adapter contract/integration suite.
3. Update maximum-tested version.
4. Publish adapter compatibility note.
5. Disable unknown high-risk approval features when necessary.

## 7. Rollback

- Preserve previous bridge binary
- Back up DB before major migration
- Keep migration compatibility policy
- Mobile supports previous two UCP versions during staged rollout when feasible

## 8. Release checklist

- CI green
- Migration tests pass
- Security scan clean
- Accessibility smoke test
- Runtime matrix updated
- Changelog complete
- Signed artifacts verified
- Local-only operation smoke-tested with internet blocked
