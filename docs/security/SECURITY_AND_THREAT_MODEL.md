# Security and Threat Model

## 1. Security objective

Allow a paired mobile device to control coding agents without exposing runtime credentials, public host ports, or plaintext agent content to an optional relay.

## 2. Protected assets

- Source code and diffs
- Runtime credentials and provider API keys
- Shell/filesystem capabilities
- Agent prompts and output
- Approval decisions
- Device identity keys
- Host identity keys
- Session metadata
- Audit records

## 3. Adversaries

- Attacker on local network
- Malicious website attempting DNS rebinding
- Compromised or curious relay operator
- Stolen phone
- Malicious paired device
- Compromised runtime/plugin
- Malicious prompt content
- Supply-chain attacker
- Local unprivileged process

## 4. Security invariants

1. No control without a valid paired-device grant.
2. Runtime/provider credentials remain on the host.
3. Relay cannot decrypt UCP content.
4. Unknown approval types cannot be remotely approved.
5. Runtime descriptions are not trusted security metadata.
6. Every remote decision is auditable.
7. Device revocation is effective on reconnect and active connection teardown.
8. Local-first operation does not require disabling authentication.

## 5. Threats and mitigations

### Local network interception

Mitigate with encrypted authenticated transport and pinned host/device identities.

### DNS rebinding/local web attack

- Validate Origin on browser-accessible endpoints.
- Do not expose an unauthenticated local HTTP API.
- Bind admin UI to localhost by default.
- Require CSRF protection for browser state changes.

### Relay compromise

- End-to-end encryption between phone and bridge.
- Short-lived routing grants.
- No plaintext notification detail.
- Replay protection and expiry.
- Rate limiting.

### Stolen phone

- OS secure storage.
- Optional app lock.
- Biometric gate for high-risk actions.
- Minimal cached context.
- Remote revocation from bridge.

### Malicious paired device

- Per-device grants/scopes.
- Approval compare-and-set.
- Audit events.
- Immediate revocation.
- Optional read-only device role later.

### Prompt injection in summaries

- Display exact command/path/tool data separately.
- Mark model-generated summaries.
- Use deterministic risk rules.
- Never allow agent prose to change available approval semantics.

### Runtime protocol drift

- Version detection.
- Schema validation.
- Compatibility mode.
- Unknown approvals fail closed.

### Supply-chain compromise

- Lockfiles.
- Dependency review.
- Signed bridge releases.
- SBOM.
- Reproducible-build target.
- Automated vulnerability scanning.

## 6. Identity and pairing

Use:

- Long-term host identity
- Long-term device identity in secure storage
- One-time pairing nonce
- Short expiry
- Human-readable fingerprint
- Per-device signed grant
- Connection-specific ephemeral session keys

Exact cryptographic construction must be reviewed before production. Use audited standard libraries, not custom primitives.

## 7. Authorization model

### Device scopes

Initial release:

- `control`: normal paired device
- `read_only`: optional later

Future granular scopes:

- View sessions
- Send prompts
- Answer low-risk approvals
- Answer high-risk approvals
- Manage devices

### Runtime authorization

Runtime-native policies remain authoritative. Agent Deck cannot grant a permission the runtime does not offer.

## 8. Biometric policy

Suggested default biometric requirement:

- Critical approval: required
- High-risk session-persistent approval: required
- Device revocation: required
- Low-risk one-time approval: configurable

Biometric success unlocks a locally protected device operation; it is not sent as biometric data.

## 9. Redaction

Redact common secret patterns before mobile publication:

- API keys
- Bearer tokens
- Private keys
- Password assignments
- Cloud access keys
- Connection strings
- `.env` values

Redaction rules should be extensible and tested against false positives/negatives.

## 10. Audit log

Record:

- Pair/revoke
- Authentication failures
- Approval requested/answered/resolved
- Device and host policy changes
- Runtime compatibility warnings
- Diagnostic export

Do not record full secrets, prompts, or code by default.

## 11. Security testing gates

Before public beta:

- Threat-model review
- Static analysis
- Dependency scan
- Secret scan
- Replay and tampering tests
- Pairing nonce reuse tests
- Revocation tests
- DNS rebinding test
- Mobile secure-storage verification

Before managed relay GA:

- Independent penetration test
- Cryptographic protocol review
- Incident response runbook
- Key-rotation exercise
- Relay data-flow privacy review

## 12. Incident response

Define:

- Severity classification
- Revocation mechanism
- Emergency bridge/relay version blocklist
- User notification process
- Security contact
- Evidence-preserving sanitized logs
- Public advisory process
