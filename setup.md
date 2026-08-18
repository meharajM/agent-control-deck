# Agent Deck Setup

Agent Deck has two parts:

- **Agent Deck Connector** runs on the computer and connects to OpenCode.
- **Agent Deck** runs on the phone and provides the control deck.

No Agent Deck account is required. The phone and computer communicate over the local network.

## Before You Start

1. Install OpenCode on the computer.
2. Open OpenCode once and complete its normal provider/authentication setup.
3. Install and open the Agent Deck Connector on the same computer.
4. Install the Agent Deck mobile app on the phone.

## Connect The Phone

1. Open the Agent Deck Connector.
2. Note the connector WebSocket address and 4-digit pairing code.
3. On the phone, open Agent Deck and tap **Pair a computer**.
4. Select the discovered computer, then enter the 4-digit code.
5. Wait for the deck to show **Connected**.

For the Android simulator development build, tap **Use Local Simulator Bridge** instead of selecting a discovered computer.

## Use The Deck

1. Enter a first instruction in **What should it do?**.
2. Tap **Start**.
3. Select the new agent to see its status and current activity.
4. Use **Send instruction** to steer the agent while it works.
5. Review and answer approval or question requests when they appear.
6. Tap an agent to focus its OpenCode session on the computer when desktop focus is available.

The agent continues running on the computer if the phone disconnects. The app synchronizes the current state when it reconnects.

## Connection Problems

- Confirm the connector is open and shows OpenCode as available.
- Confirm the phone and computer are on the same local or private network.
- Generate a new pairing code if the displayed code has expired.
- Reopen the connector if it reports that its runtime connection is unavailable.
- Reconnect from **Connection and setup** in the app if the deck shows **Offline** or **Stale**.
- State-changing controls are disabled while the app is offline.

## Privacy And Security

- OpenCode credentials remain on the computer.
- The optional relay is not required for local operation.
- Do not share pairing codes or connector addresses publicly.
- Background notifications may not be available when the phone is disconnected from the local network.

## Current Build Note

The current development build uses 4-digit code pairing. The iOS development build requires Xcode 26.0+ (Swift tools 6.2) on macOS 15.6+. If Xcode is installed alongside another version, accept its license once and set `DEVELOPER_DIR` to its `Contents/Developer` path. The Android simulator's local bridge shortcut uses plaintext development mode only for `127.0.0.1`; do not enable plaintext development mode on a LAN or production computer.
