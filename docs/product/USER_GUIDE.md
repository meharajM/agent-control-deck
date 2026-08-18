# Agent Deck User Guide

Agent Deck is a local-first mobile control deck for supervising Codex and OpenCode tasks running on your computer. The phone is the control surface; the host bridge runs the agent and keeps runtime credentials on the computer.

```text
iPhone or Android app -- local Wi-Fi/private network --> Agent Deck bridge --> Codex or OpenCode
```

## 1. Choose an install path

### Current development/test install

This repository does not currently publish a public App Store or Google Play download. For device testing, build and install the mobile development app from the repository.

Requirements:

- macOS 15.6+ and Xcode 26.0+ for the current iOS build
- macOS, Windows, or Linux for bridge development; macOS or Windows for Android development
- Node.js 24 LTS
- pnpm 9+
- Android Studio and JDK 17 for Android builds
- A Mac or PC with Codex or OpenCode installed and authenticated

Clone and build the workspace:

```bash
git clone https://github.com/meharajM/agent-control-deck.git
cd agent-control-deck
corepack enable
pnpm install
pnpm build
```

For the normal one-time host setup, run the repository script instead:

```bash
./setup.sh
```

It installs dependencies and builds the host, asks at most three questions, detects OpenCode or Codex, persists host-only configuration, installs automatic host startup where supported, and installs an `opencode` wrapper that attaches to the shared authenticated server. After setup, the bridge imports and watches sessions created from OpenCode or the phone.

Install the iOS development app on a connected iPhone:

```bash
cd apps/mobile
pnpm ios
```

Install the Android development app on the configured emulator:

```bash
cd apps/mobile
pnpm android
```

For a development build, keep the JavaScript bundler running when the app asks for its development bundle:

```bash
pnpm --filter @agent-deck/mobile start
```

### Planned release install

The release plan supports TestFlight for iOS and Google Play internal testing followed by public release for Android. Store links, signed host installers, and start-on-login packaging are release work and are not available in this repository yet.

## 2. Install and verify an agent runtime

Install and authenticate at least one supported runtime on the computer that will run the bridge.

For OpenCode:

```bash
opencode --version
```

The one-time setup starts OpenCode `serve` on loopback with generated local authentication. Normal `opencode` invocations attach to that server, and the bridge discovers their sessions. Do not expose OpenCode directly on the LAN and do not put provider API keys in the mobile app.

For Codex, verify the `codex` command is installed and authenticated before starting the Codex bridge profile.

## 3. Start the host bridge

The bridge must run continuously while the phone supervises tasks. `./setup.sh` installs a start-on-login host launcher; manual launch remains available for development.

Find the computer's Wi-Fi address. On many Macs this is:

```bash
ipconfig getifaddr en0
```

Start OpenCode mode, replacing `<MAC_IP>` with that address:

```bash
cd agent-control-deck
BRIDGE_RUNTIME=opencode BRIDGE_INTERFACE=<MAC_IP> BRIDGE_PORT=8765 pnpm start:bridge:opencode
```

Example:

```bash
BRIDGE_RUNTIME=opencode BRIDGE_INTERFACE=192.168.29.137 BRIDGE_PORT=8765 pnpm start:bridge:opencode
```

This manual command uses Agent Deck-managed OpenCode sessions. For terminal sessions that remain visible across host restarts, use `./setup.sh` and then run `opencode` from the configured project directory.

The bridge prints a temporary four-digit pairing code. It also advertises itself for local discovery. Never share the pairing code or runtime credentials publicly.

Other runtime profiles:

```bash
BRIDGE_RUNTIME=codex BRIDGE_INTERFACE=<MAC_IP> BRIDGE_PORT=8765 pnpm start:bridge:codex
BRIDGE_RUNTIME=fake BRIDGE_INTERFACE=<MAC_IP> BRIDGE_PORT=8765 pnpm start:bridge:fake
```

Do not start a second bridge on the same port. Stop a running bridge with `Ctrl-C`.

## 4. Pair the phone

1. Put the phone and computer on the same Wi-Fi or private network.
2. Open Agent Deck and allow local-network access when iOS or Android asks.
3. Tap **Find Computers**.
4. Select the Agent Deck host.
5. Enter the four-digit code printed by the bridge.
6. Tap **Connect**.

If discovery does not find the host, use the manual fields:

- Bridge address: `192.168.29.137:8765` or `<MAC_IP>:8765`
- Pairing code: the newest code in the bridge terminal

The pairing code is short-lived and single-use. If it expires, use the newest code printed after restarting or rotating the bridge pairing flow.

After pairing, the app synchronizes a snapshot before enabling actions. Cached state is read-only while disconnected or stale.

## 5. Start and manage an agent task

### Start a task

1. Open the control deck after pairing.
2. In the first-instruction field, describe the task in one or two sentences.
3. Send the instruction.
4. The bridge creates the runtime session and starts the agent.

When using OpenCode from the computer, run `opencode` normally after setup. The wrapper attaches the terminal to the same authenticated server that the bridge watches. Sessions created there appear on the deck without another pairing step.

For OpenCode, no separate `opencode serve` command is required. Agent Deck manages that local server behind the bridge.

Good first instructions include:

- “Inspect the failing login test, explain the root cause, and propose a fix.”
- “Implement the requested change, run the relevant tests, and summarize the result.”
- “Review the current diff for security or data-loss risks. Do not modify files.”

### Monitor work

Each active task appears as a session key. Select one to see:

- Current state and action
- Runtime, host, project, and elapsed time
- Recent meaningful messages
- Changed files, tests, commands, and raw details when available

The deck prioritizes tasks that need attention, followed by failures, running tasks, queued tasks, and recent completions.

| App state | Meaning | What you can do |
| --- | --- | --- |
| Ready | Session can accept a new prompt | Send a task or follow-up |
| Working | Agent is running | Steer or stop when supported |
| Needs you | Agent asks a question or permission | Review details and answer |
| Done | Runtime confirmed completion | Inspect summary and send follow-up |
| Problem | Agent failed or was interrupted | Read the reason, then retry or redirect |
| Offline | Cached state is stale | Read only; reconnect before acting |

### Steer an agent

Use the text instruction field on the selected session for a short correction or next step, for example:

- “Focus only on the API validation; leave the UI unchanged.”
- “Run the smallest relevant test suite before editing more files.”
- “Stop after inspecting the failure and report what you found.”

The app labels the action as **Send** or **Steer** based on the runtime capability. A sent command is not proof of completion; wait for the confirmed runtime result.

### Approve or reject requests

When a task needs permission, open its approval card and check:

- Exact command, path, tool, or network destination
- Working directory and affected files
- Runtime-provided reason
- Risk and reversibility
- Whether approval persists for the session

Choose the runtime-supported decision. The card remains visible until the bridge and runtime confirm the outcome. Do not repeatedly tap a decision while it is being resolved.

### Answer questions

Open a pending question, choose the requested option or enter text, review it, and submit. The bridge preserves the runtime question ID and prevents duplicate answers.

### Stop work

Open the selected task and tap **Stop**. Confirm the action when prompted. The final state appears only after the runtime confirms cancellation or interruption.

### Review completed work

Completed tasks remain on the main deck for a limited period, then move to session history. Open the task to review its summary, changed files, and test results before deciding whether to send a follow-up instruction.

## 6. Disconnects and reconnects

If the phone leaves the network or the bridge stops:

- The host agent continues running on the computer.
- The app shows cached state as stale or offline.
- State-changing controls are disabled.
- Reopen the app or restore the network to reconnect.
- Wait for synchronization before sending, approving, answering, retrying, or stopping.

Agent tasks do not depend on the phone staying connected. The bridge is authoritative for task state and reconciles the runtime after a restart.

## 7. Troubleshooting

### Host does not appear in Find Computers

- Confirm phone and computer use the same Wi-Fi.
- Allow local-network access for Agent Deck in system settings.
- Confirm the bridge terminal is still running.
- Confirm the bridge is listening on port `8765`.
- Enter `<MAC_IP>:8765` manually.

### Connect appears to do nothing

- Use the newest four-digit code; old codes expire.
- Enter the address as `IP:port`, for example `192.168.29.137:8765`.
- Confirm the bridge terminal shows no pairing or authentication error.
- Stop duplicate bridge processes and start one bridge again.
- Reopen the app after changing network or local-network permissions.

### OpenCode task does not start

- Run `opencode --version` on the host.
- Confirm OpenCode provider authentication is complete on the host.
- Start the bridge with `BRIDGE_RUNTIME=opencode`.
- Check the bridge terminal for the OpenCode server health error.
- Do not run OpenCode on a public or LAN-facing port; it should remain behind the bridge on loopback.

### Development app opens but cannot load

The current development build needs Metro. From the repository root, run:

```bash
pnpm --filter @agent-deck/mobile start
```

Keep Metro running, then relaunch the installed development app.

## 8. Privacy and safety

- Runtime/provider credentials stay on the host.
- The phone receives normalized task state and only the details needed for supervision.
- Treat approval requests as real permissions; inspect exact commands and paths.
- Never paste API keys, pairing codes, or private runtime logs into public issues.
- Agent Deck is not a mobile IDE, terminal, remote desktop, or automatic-approval tool.

## 9. Quick reference

```bash
# First setup
git clone https://github.com/meharajM/agent-control-deck.git
cd agent-control-deck
corepack enable
pnpm install
pnpm build

# One-time host setup
./setup.sh

# Or start OpenCode bridge manually
BRIDGE_RUNTIME=opencode BRIDGE_INTERFACE=<MAC_IP> BRIDGE_PORT=8765 pnpm start:bridge:opencode

# Start Codex bridge
BRIDGE_RUNTIME=codex BRIDGE_INTERFACE=<MAC_IP> BRIDGE_PORT=8765 pnpm start:bridge:codex

# Start mobile development bundle
pnpm --filter @agent-deck/mobile start
```
