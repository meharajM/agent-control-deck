import { BridgeApp } from './bridge-app.js';
import { probeCodex } from '@agent-deck/adapter-codex';
import { publishBridgeService } from './service-discovery.js';
import { parseBridgeDevMode, parseBridgeRuntime } from './runtime-selection.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function selectRuntime(): Promise<ReturnType<typeof parseBridgeRuntime>> {
  if (process.env.BRIDGE_RUNTIME) return parseBridgeRuntime(process.env.BRIDGE_RUNTIME);
  if ((await probeCodex()).available) return 'codex';
  try {
    await execFileAsync('which', ['opencode']);
    return 'opencode';
  } catch {
    // Use fake adapter only when no supported runtime is installed.
  }
  throw new Error('No Codex or OpenCode installation found. Install one runtime or set BRIDGE_RUNTIME=fake for development.');
}

async function main() {
  const port = Number(process.env.BRIDGE_PORT ?? 8765);
  const dbPath = process.env.BRIDGE_DB_PATH ?? './bridge.db';
  const runtime = await selectRuntime();
  const allowInsecureLegacyMode = parseBridgeDevMode(process.env.BRIDGE_DEV_MODE);

  const app = new BridgeApp({ port, dbPath, runtime, allowInsecureLegacyMode });
  let discovery: { stop: () => void } | null = null;
  let pairingRefreshTimer: ReturnType<typeof setInterval> | null = null;

  // Handle graceful shutdown
  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\nShutting down...');
    if (pairingRefreshTimer) clearInterval(pairingRefreshTimer);
    discovery?.stop();
    app.stop();
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.start();
  const gateway = app.getGateway();
  console.log(`Bridge listening on ws://${gateway?.host || '0.0.0.0'}:${gateway?.port}`);
  console.log(`Host ID: ${app.hostId}`);
  console.log(`Runtime: ${runtime}`);

  const pairingEndpoint =
    process.env.BRIDGE_PAIRING_ENDPOINT ??
    `ws://${gateway?.host || '127.0.0.1'}:${gateway?.port ?? port}`;
  const publishPairing = () => {
    const pairing = app.createPairingCode([pairingEndpoint]);
    console.log(`Agent Deck pairing code: ${pairing.code}`);
    console.log(`Pairing expires: ${pairing.expiresAt}`);
    discovery?.stop();
    discovery = publishBridgeService({
      port: gateway?.port ?? port,
      hostId: app.hostId,
      hostName: pairing.hostName,
      hostPublicKey: pairing.hostPublicKey,
    });
  };
  publishPairing();
  pairingRefreshTimer = setInterval(publishPairing, 4 * 60 * 1000);

  if (runtime === 'fake') {
    const adapterManager = app.getAdapterManager();
    const adapter = adapterManager?.getAdapter('fake');
    if (adapter) {
      const sessionId = await adapter.startSession({ instruction: 'Demonstrate Agent Deck' });
      console.log(`Auto-started demo session: ${sessionId}`);
    } else {
      console.warn('No fake adapter registered; mobile will show empty session list until a session is started');
    }
  }
}

main().catch((err) => {
  console.error('Bridge startup failed:', err);
  process.exit(1);
});
