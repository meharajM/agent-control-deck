# Observability

## Principles

Collect operational signals without collecting source code, prompts, commands, or secrets by default.

## Metrics

- Active UCP connections
- Reconnect duration
- Event delivery latency
- Sequence gaps
- Snapshot resets
- Command states/failures/retries
- Pending approvals and round-trip latency
- Adapter connected state and errors
- Reconciliation duration
- Relay frame routing/rejection
- Voice transcription duration/failure
- Push request/delivery

## Structured log fields

- Timestamp
- Severity
- Component
- Event type
- Correlation ID
- Host/session pseudonymous IDs
- Runtime kind/version
- Duration
- Error code

## Forbidden log content

- Full prompts
- Source code
- Secret values
- Full filesystem paths by default
- Raw audio
- Runtime passwords/API keys

## Diagnostics bundle

Include:

- Bridge/app versions
- Adapter/runtime versions
- Protocol versions
- Health checks
- Sanitized recent errors
- Database integrity result
- Redacted configuration

Require user confirmation before export.

## Local-first telemetry

Telemetry is opt-in. Local operation does not require analytics. Self-hosted users can disable all outbound observability.
