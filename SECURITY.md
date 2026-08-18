# Security Policy

## Supported versions

This project is an early preview. Security fixes target the latest commit on `main` and the latest version tag.

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability. Use a private GitHub Security Advisory for this repository, or contact a repository maintainer through the GitHub profile if Security Advisories are unavailable.

Include:

- affected commit or tag;
- reproduction steps or a minimal proof of concept;
- impact and likely exploitability;
- logs or screenshots only after removing prompts, code, paths, credentials, pairing codes, and personal data.

Please allow maintainers reasonable time to investigate before public disclosure.

## Security boundaries

- Runtime/provider credentials stay on the host computer.
- OpenCode is expected to bind to loopback behind the Agent Deck bridge.
- Mobile pairing codes are temporary and single-use.
- The bridge is authoritative for pairing, command acceptance, approval state, and reconciliation.
- Never use `BRIDGE_DEV_MODE` on a LAN or production network.

See [the threat model](docs/security/SECURITY_AND_THREAT_MODEL.md) for the current design and open release gates.
