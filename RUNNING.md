# Running Agent Deck — Developer Quickstart

This guide walks through running the bridge and mobile app end-to-end on your development machine.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 24+ | LTS recommended |
| pnpm | 9+ | `corepack enable pnpm` |
| Xcode | 26.0+ (Swift 6.2) | Expo SDK 56 requires Swift tools version 6.2. Xcode 26 requires macOS 15.6+. |
| Android Studio | Latest | For Android emulator |
| Expo CLI | — | `npx expo` works; global install optional |

---

## 1. Install Dependencies

```bash
pnpm install
```

---

## 2. Build All Packages

```bash
pnpm build
```

This compiles all TypeScript packages to `dist/`.

---

## 3. Start the Bridge

The bridge runs the WebSocket server that the mobile app connects to.

```bash
pnpm start:bridge
# or: pnpm --filter @agent-deck/bridge start
```

Output:
```
Bridge listening on ws://0.0.0.0:8765
Host ID: <uuid>
Auto-started demo session: <uuid>
```

The bridge listens on **port 8765** by default. Change with `BRIDGE_PORT=9000 pnpm start:bridge`.

The bridge database is at `./bridge.db` (or `BRIDGE_DB_PATH=:memory:` for ephemeral).

---

## 4. Find Your Machine's LAN IP

The mobile app needs your machine's **LAN IP** (not `localhost`), unless running in an iOS simulator.

```bash
# macOS / Linux
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1
# Example output: inet 192.168.1.42 netmask 0xffffff00 broadcast 192.168.1.255
# Your IP is 192.168.1.42
```

---

## 5. Start the Mobile App

### iOS Simulator (macOS only)

```bash
DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer pnpm --filter @agent-deck/mobile ios --device "AgentDeck iPhone 16 (iOS 26.5)"
```

- In the iOS simulator, paste the pairing code printed by the bridge. Use `BRIDGE_PAIRING_ENDPOINT=ws://localhost:8765` if the generated endpoint is not reachable.

### Android Emulator

```bash
pnpm --filter @agent-deck/mobile android
```

- In the Android emulator, forward the bridge port and paste the pairing code printed by the bridge. Generate a simulator-reachable code with:

  ```bash
  adb reverse tcp:8765 tcp:8765
  ```

  Set `BRIDGE_PAIRING_ENDPOINT=ws://127.0.0.1:8765` when starting the bridge. `ws://10.0.2.2:8765` remains the fallback when port forwarding is unavailable.

### Physical Device (iOS or Android)

1. Ensure your phone is on the **same Wi-Fi network** as your computer.
2. Use the LAN IP from step 4: `ws://192.168.1.42:8765`
3. Run the dev build:
   ```bash
   # iOS
   DEVELOPER_DIR=/Applications/Xcode-26.6.0.app/Contents/Developer pnpm --filter @agent-deck/mobile ios --device "<your iOS device name>"

   # Android
   pnpm --filter @agent-deck/mobile android
   ```

> **Note:** Expo Go will **not work** — the app uses native modules (`expo-camera`, `expo-local-authentication`, `expo-secure-store`). You must run a development build (`expo run:ios` / `expo run:android`).

---

## 6. Pair and Test

1. Open the app on simulator/device.
2. Tap **"Pair a Host"**.
3. Enter the WebSocket URL from step 5 (e.g., `ws://192.168.1.42:8765`).
4. Tap **Connect**.
5. You'll land on the **Sessions** screen showing **"Demo Session"** with status **"Working"**.
6. Tap the session → you'll see a pending approval: **"Write src/hello.ts"**.
7. Tap the approval → press **Approve** or **Reject**.
8. The bridge logs the decision and the session completes.

---

## Running Tests

```bash
# All packages (263 tests across 9 packages)
pnpm test

# Specific package
pnpm --filter @agent-deck/bridge test
pnpm --filter @agent-deck/mobile test
pnpm --filter @agent-deck/qa-scenarios test
pnpm --filter @agent-deck/adapter-opencode test
pnpm --filter @agent-deck/adapter-codex test

# Type checking (10 packages)
pnpm typecheck
```

---

## Known Environment Blockers

| Issue | Status | Fix |
|-------|--------|-----|
| iOS build fails: `package 'apple' requires Swift tools 6.2.0` | **Blocked** | Install Xcode 26.6+: `xcodes install 26.6` (requires Apple ID). Then `xcodes select 26.6`. |
| `mobile-mcp` can't find `mobilecli` | **Fixed** | Added `PATH` env in `opencode.json`. Requires opencode restart to take effect. |
| Web not configured | Out of scope | Agent Deck is mobile-only (uses native modules). |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No active sessions" after connect | Bridge didn't auto-start session. Restart bridge or use "Start Demo Session" button in mobile (if added). |
| iOS: connection fails on physical device | Check firewall: `sudo pfctl -sr | grep 8765` — allow inbound on port 8765. |
| Android: `ws://localhost:8765` doesn't work | Run `adb reverse tcp:8765 tcp:8765` and use `ws://127.0.0.1:8765`; otherwise use `ws://10.0.2.2:8765` (emulator) or your LAN IP (physical device). |
| Expo Go crashes on launch | You must use a dev build: `expo run:ios` / `expo run:android`. |
| `pnpm build` fails | Run `pnpm install` first, then `pnpm build`. |
| TypeScript errors in `ucp-client.ts` | Known pre-existing issue with WebSocket type — `ws` is typed as `any` to avoid undici-types vs React Native conflict. |

---

## Architecture Recap

```
Mobile App (Expo)          Bridge (Node.js)              Runtimes
─────────────────          ────────────────              ────────
UcpClient ────── WS ────── UcpGateway ──── AdapterMgr ── FakeAdapter
   │                            │            │
   │                            │            └─> event journal → broadcast
   │                            │
   │                     SnapshotService ← DB
   │                            │
   └── session-store ←──────────┘
        (Zustand reducer)
```

- **UCP** envelopes over WebSocket (`ws` package)
- **Event journal** → `event_journal` table (sequence + idempotency)
- **Approval CAS** → `approvals` table (compare-and-set)
- **Snapshot** → sent on every new connection (`host.snapshot`)

---

## Next Steps for Development

### Immediate (unblocked)
- **Restart opencode** to pick up mobile-mcp `PATH` fix → then test app on simulator via `mobile-mcp_mobile_take_screenshot`
- **iOS simulator build/install is verified** with Xcode 26.6 on the iOS 26.5 simulator. Keep the Xcode 26.6 developer directory selected for future native builds.
- **Codex/OpenCode adapter conformance**: Both adapters implement `RuntimeAdapter`, tests pass. Need real runtime integration testing once runtimes are installed.

### Completed (Waves 0–3)
- UCP protocol contracts + generated types (29 tests)
- Bridge database + migrations (4 tests)
- Bridge core services: event journal, approval CAS, snapshot, idempotency (17 tests)
- Mobile stores + screens + services (31 tests)
- Fake adapter + QA scenario runner (25 tests)
- Bridge app entrypoint (ws://0.0.0.0:8765, auto-seeds demo session)
- Codex adapter with 27 passing tests
- OpenCode adapter with 70 passing tests (event-normalizer, client, server-manager, adapter, conformance)
- QA conformance suite for adapter compliance

### Later (Waves 4–6)
- Pairing crypto + encrypted frames (`packages/crypto/`, `packages/bridge-pairing/`)
- Relay/push (optional, behind feature flags)
- Claude beta adapter (`packages/adapter-claude/`)
- Hardening + accessibility + performance testing
