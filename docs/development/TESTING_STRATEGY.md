# Testing Strategy

## 1. Testing objective

Prove that Agent Deck remains safe and state-consistent under runtime changes, network loss, duplicate delivery, process restarts, and multiple paired clients.

## 2. Test layers

### Unit

- Schema validation
- State mapping
- Redaction
- Risk classification
- Idempotency
- Version checks
- Snapshot generation
- Route selection

### Contract

V1 shared adapter conformance suite for Codex and OpenCode. Claude conformance is a post-v1 suite and is not a v1 release gate.

### Integration

Real bridge + real runtime in isolated temporary repository.

### Mobile component

- State rendering
- Disabled controls
- Accessibility labels
- Approval decision behavior

### Mobile E2E

Use Maestro on Android emulators and iOS simulators, plus physical-device smoke testing. The default flows use the fake adapter; selected trusted jobs use real runtimes.

### Chaos

Network/process/event fault injection.

### Security

Pairing, replay, tampering, authorization, secret leakage.

### Performance/endurance

Burst events, many sessions, long bridge uptime, repeated reconnect.

## 3. Fake adapter scenarios

The fake adapter must support deterministic scripts:

- Normal completion
- Streaming message
- Command approval
- File approval
- Network approval
- User question
- Approval cancelled by runtime
- Delayed runtime confirmation
- Duplicate runtime event
- Reordered event
- Runtime crash
- Runtime restart with recoverable session
- Unrecoverable session
- Large diff
- Backpressure

## 4. Adapter contract suite

Required tests:

- Probe/start/stop
- Capabilities
- Session list/create/get/resume
- Send/stream
- Cancel
- Approval approve/reject
- Question answer
- Duplicate bridge command
- Runtime restart
- Bridge restart
- Reconciliation
- Unknown event
- Unsupported capability
- Version warning

## 5. Synchronization invariants

Test:

- Replay produces same state as full snapshot.
- Applying an event twice produces same state.
- Lower session version cannot overwrite higher version.
- Missing cursor causes snapshot reset.
- Phone controls remain disabled until sync completion.

## 6. Approval invariants

- Only one device can transition pending to answering.
- Retried answer does not call runtime twice.
- Runtime cancellation removes actionability.
- Phone disconnect does not imply approval.
- Bridge restart does not auto-approve.
- Unknown approval type fails closed.

## 7. Chaos matrix

Inject:

- Wi-Fi to cellular/private-route transition
- Socket close before ACK
- Socket close after ACK before runtime confirmation
- Relay loss
- Bridge kill
- Adapter worker kill
- Runtime kill
- Database busy/temporary lock
- Duplicate/out-of-order frame
- Clock skew
- Two-device race

Pass condition: normalized state converges to runtime truth and no state-changing action duplicates.

## 8. Security tests

- Pairing nonce replay
- Expired four-digit pairing code
- Invalid host fingerprint
- Revoked device reconnect
- Active revoked device disconnect
- Frame modification
- Sequence replay
- Oversized JSON/binary frame
- Origin/DNS rebinding attempts
- CSRF on local admin UI
- Secret pattern in logs/push payload
- Malicious model summary attempting to hide command

## 9. Accessibility tests

- VoiceOver approval flow
- TalkBack approval flow
- Maximum text scale
- High contrast/grayscale
- Reduced motion
- Switch access where practical
- External keyboard navigation
- No color-only state
- Text-only alternative to voice

## 10. Performance targets

- 100 sessions snapshot under five seconds
- 1,000 normalized events/minute burst without data loss
- Direct state delivery p95 under 500 ms
- Direct command ACK p95 under 750 ms
- Private/relay targets tracked separately
- 7-day bridge endurance without unbounded memory growth

## 11. CI matrix

- Node 24 LTS on macOS, Linux, Windows
- Android/iOS app typecheck/unit tests
- SQLite migration tests
- Protocol fixture validation
- Adapter mock contract tests on every PR
- Real runtime integration tests on scheduled/controlled workflows

## 12. Release gates

No release when:

- Any approval duplication test fails
- Database migration lacks rollback/backup validation
- New unauthenticated network endpoint exists
- VoiceOver/TalkBack core flow is broken
- Runtime adapter uses unknown approval schema without fail-closed behavior
