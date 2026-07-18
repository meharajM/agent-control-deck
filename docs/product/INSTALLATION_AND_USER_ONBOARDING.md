# Installation and User Onboarding

## 1. Local-first installation goal

A new user should reach a connected fake or real runtime without creating an Agent Deck account.

## 2. Host installation

### macOS

- Signed `.pkg` or `.dmg`
- Install into user Applications/support directories
- Optional LaunchAgent for start at login
- CLI available as `agent-deck`

### Windows

- Signed MSI/MSIX or conventional installer
- Run in signed-in user context
- Optional startup task
- Do not require administrator privileges except installer/firewall changes when unavoidable

### Linux

- `.deb`, `.rpm`, or portable archive
- systemd user unit where available
- foreground CLI fallback

## 3. First-run host wizard

1. Check bridge database directory.
2. Detect Codex, OpenCode, and Claude capability.
3. Show runtime authentication status without reading secrets.
4. Keep bridge on loopback.
5. Generate host identity.
6. Ask user to enable LAN access.
7. Select private interface.
8. Display QR code.
9. Confirm paired device.
10. Run connection self-test.

## 4. Mobile onboarding

1. Explain local network use.
2. Request camera permission only when QR scanning starts.
3. Request local-network permission before first connection.
4. Scan QR.
5. Verify host name and fingerprint.
6. Store device credential.
7. Synchronize snapshot.
8. Show runtime status and any setup issue.

## 5. Manual fallback

Allow manual input of:

- Host address
- Port
- Pairing code/QR text
- Private-network address

mDNS failure must never block setup.

## 6. Doctor command

`agent-deck doctor` checks:

- database read/write and migration state
- selected network interface
- port availability
- host identity
- runtime binary paths and versions
- OpenCode health/authentication
- Codex app-server handshake
- Claude SDK executable availability
- firewall reachability guidance
- clock sanity

The command produces a redacted report.

## 7. No-server behavior disclosure

State clearly:

- App works on LAN/private network without an Agent Deck server.
- Background push is not guaranteed without optional push infrastructure.
- Agent tasks continue on the host while the phone is disconnected.
- The phone resynchronizes when opened.
