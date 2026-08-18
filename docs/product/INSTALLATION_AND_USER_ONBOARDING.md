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

## 3. First-run host setup

1. Check bridge database directory.
2. Detect Codex and OpenCode capability. Claude detection is post-v1.
3. Show runtime authentication status without reading secrets.
4. Install the Agent Deck Host tray/menu-bar companion and start the bridge in the signed-in user's session.
5. Generate host identity.
6. Ask user to enable LAN access.
7. Select private interface.
8. Publish `_agent-deck._tcp` on the selected private network and display a temporary 4-digit pairing code.
9. Confirm paired device.
10. Run connection self-test.

## 4. Mobile onboarding

1. Explain local network use.
2. Request local-network permission before first connection.
3. Discover the Agent Deck Host automatically.
4. Enter the 4-digit code shown by the host companion.
5. Verify host name and fingerprint.
6. Store device credential.
7. Synchronize snapshot.
8. Open the control deck and show every active agent plus any setup issue.

After initial pairing, connection setup, diagnostics, and host controls move to the deck overflow menu. They do not remain in persistent primary navigation.

## 5. Manual fallback

If discovery is unavailable, allow manual input of:

- Host address
- Port
- Four-digit pairing code
- Private-network address

mDNS failure must never block development setup; production onboarding should explain that both devices must be on the same private network.

## 6. Doctor command

`agent-deck doctor` checks:

- database read/write and migration state
- selected network interface
- port availability
- host identity
- runtime binary paths and versions
- OpenCode health/authentication
- Codex app-server handshake
- Post-v1 runtime checks are not required for v1 onboarding
- firewall reachability guidance
- clock sanity

The command produces a redacted report.

## 7. No-server behavior disclosure

State clearly:

- App works on LAN/private network without an Agent Deck server.
- Background push is not guaranteed without optional push infrastructure.
- Agent tasks continue on the host while the phone is disconnected.
- The phone resynchronizes when opened.
