# ADR 0002: Use a Host Bridge

## Status
Accepted

## Decision
A local bridge integrates runtimes and exposes one UCP interface to mobile.

## Alternatives rejected

- Direct mobile-to-runtime clients
- MCP-only control
- PTY-only control
- Independent runtime plugins talking directly to mobile

## Consequences

- Requires host installation.
- Centralizes security, persistence, and reconnect logic.
- Keeps runtime credentials off the phone.
