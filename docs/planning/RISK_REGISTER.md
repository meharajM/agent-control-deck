# Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---:|---:|---|
| R1 | Runtime APIs change quickly | High | High | Version probes, schemas, contract CI, capability flags |
| R2 | Claude arbitrary-session attachment lacks reliable supported API | High | Medium | Ship bridge-managed SDK sessions; label attachment experimental |
| R3 | Approval normalization hides critical detail | Medium | Critical | Raw deterministic data, fail closed, security review |
| R4 | Reconnect creates duplicate action | Medium | Critical | Command ledger, idempotency, runtime confirmation |
| R5 | Relay becomes trusted content store | Medium | High | E2E encryption, routing-only architecture |
| R6 | Mobile app drifts into IDE | High | Medium | Formal non-goals, product review gate |
| R7 | Voice scope delays core reliability | Medium | Medium | Defer until local MVP works |
| R8 | Local network endpoint exposed unsafely | Medium | Critical | Paired application encryption, safe bind defaults, no unauthenticated endpoint |
| R9 | Agent-generated summary manipulates user | Medium | High | Deterministic details, mark generated text, no hidden raw action |
| R10 | Multi-agent development creates conflicting contracts | High | Medium | Coordinator, ownership boundaries, contract freeze |
| R11 | Database migration loses state | Low | High | Backup, migration tests, rollback policy |
| R12 | Background notification unavailable without server | Certain | Medium | Explicit product behavior; optional relay/push later |
| R13 | Third-party runtime authentication terms restrict integration | Medium | High | Use officially supported authentication; legal review |
| R14 | Accessibility added too late | Medium | High | Include from first mobile slice and release gates |
| R15 | Self-signed WSS/pinning blocks mobile implementation | Mitigated | High | Application-encrypted local WS; WSS only for trusted/public endpoints |
| R16 | Node single-executable/native-addon packaging fails | Mitigated | High | Bundle official Node runtime; target-specific installers |
| R17 | Detox lags selected React Native release | Mitigated | Medium | Maestro default E2E framework |
| R18 | mDNS/native discovery module causes build issues | Low | Medium | QR/manual endpoint is mandatory; discovery optional |
| R19 | Dedicated speech stack delays release | Medium | Medium | Text and OS dictation in v1; push-to-talk beta |
