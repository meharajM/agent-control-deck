# ADR 0006: Native Runtime Adapters

## Status
Accepted

## Decision
Use Codex app-server, OpenCode server/OpenAPI/SSE, and bridge-managed Claude Agent SDK sessions. Do not make MCP the only runtime-control path.

## Consequences

- Best available capability parity.
- Adapter maintenance required.
- MCP can be layered later for portability and tool exposure.
