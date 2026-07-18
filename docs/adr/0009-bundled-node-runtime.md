# ADR 0009: Bundle Node Runtime Instead of SEA

## Status

Accepted.

## Decision

Ship platform-specific bridge installers containing the official Node 24 runtime, bundled application code, resources, and native dependencies. Do not use Node SEA for v1.

## Reason

SEA remains active-development and complicates native dependency and platform packaging. A bundled runtime is predictable and testable.
