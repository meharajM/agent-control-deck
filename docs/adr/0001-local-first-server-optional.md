# ADR 0001: Local-First, Server-Optional Product

## Status
Accepted

## Decision
The host bridge and mobile app support LAN and user-managed private-network operation without a vendor account or managed server. Hosted relay/push services are optional enhancements.

## Consequences

- Core product remains usable during vendor outage.
- MVP avoids backend operations.
- Background push is limited until optional infrastructure exists.
- Pairing/device authority initially resides on the host.
