# Agent Deck Setup

Agent Deck has two parts:

- **Agent Deck host bridge** runs on the computer and connects to OpenCode or Codex.
- **Agent Deck** runs on the phone and provides the control deck.

No Agent Deck account is required. The phone and computer communicate over the local network.

## One-time host setup

From an open-source checkout, run:

```bash
./setup.sh
```

The script installs dependencies and builds the host, then asks for runtime when both OpenCode and Codex are installed, asks for the project directory, and asks whether to start automatically at sign-in. It then:

- builds the workspace;
- creates a user-only host config under `~/.config/agent-deck/`;
- keeps OpenCode on loopback with generated authentication;
- installs `agent-deck-host` under `~/.local/bin/`;
- installs a shell `opencode` wrapper that attaches to the shared server;
- configures macOS LaunchAgent or Linux systemd user startup when available.

No provider API key is collected or copied by Agent Deck.

## Before You Start

1. Install OpenCode on the computer.
2. Open OpenCode once and complete its normal provider/authentication setup.
3. Run `./setup.sh` in the Agent Deck repository.
4. Install and open the Agent Deck mobile app on the phone.

## Connect The Phone

1. Ensure `agent-deck-host` is running (the setup script starts it automatically when configured).
2. Read the bridge WebSocket address and temporary 4-digit pairing code from `~/.local/state/agent-deck/bridge.log`.
3. On the phone, open Agent Deck and tap **Find Computers**.
4. Select the discovered computer, then enter the 4-digit code.
5. Wait for the deck to show **Connected**.

For the Android simulator development build, tap **Use Local Simulator Bridge** instead of selecting a discovered computer.

## Use The Deck

1. Run `opencode` from the configured project directory, or enter a first instruction in the deck.
2. Tap **Start** when starting from the phone.
3. Select the new agent to see its status and current activity.
4. Use **Send instruction** to steer the agent while it works.
5. Review and answer approval or question requests when they appear.
6. Tap an agent to focus its OpenCode session on the computer when desktop focus is available.

The agent continues running on the computer if the phone disconnects. The app synchronizes the current state when it reconnects.

## Connection Problems

- Confirm `agent-deck-host` is running and shows OpenCode as available in `~/.local/state/agent-deck/bridge.log`.
- Confirm the phone and computer are on the same local or private network.
- Generate a new pairing code if the displayed code has expired.
- Restart `agent-deck-host` if it reports that its runtime connection is unavailable.
- Reconnect from **Connection and setup** in the app if the deck shows **Offline** or **Stale**.
- State-changing controls are disabled while the app is offline.

## Privacy And Security

- OpenCode credentials remain on the computer.
- The optional relay is not required for local operation.
- Do not share pairing codes or connector addresses publicly.
- Background notifications may not be available when the phone is disconnected from the local network.

## Current Build Note

The current development build uses 4-digit code pairing. The iOS development build requires Xcode 26.0+ (Swift tools 6.2) on macOS 15.6+. If Xcode is installed alongside another version, accept its license once and set `DEVELOPER_DIR` to its `Contents/Developer` path. The Android simulator's local bridge shortcut uses plaintext development mode only for `127.0.0.1`; do not enable plaintext development mode on a LAN or production computer.
