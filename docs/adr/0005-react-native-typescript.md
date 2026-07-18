# ADR 0005: React Native and TypeScript

## Status
Accepted

## Decision
Use React Native/TypeScript for mobile and Node.js/TypeScript for the bridge.

## Consequences

- Shared generated types and validation libraries.
- Native modules still needed for advanced audio, secure identity, and certificate handling.
- Expo development builds preferred over Expo Go-only workflow.
