import { BridgeApp } from './bridge-app.js';
import { parseBridgeRuntime } from './runtime-selection.js';

async function main() {
  const port = Number(process.env.BRIDGE_PORT ?? 8765);
  const dbPath = process.env.BRIDGE_DB_PATH ?? './bridge.db';
  const runtime = parseBridgeRuntime(process.env.BRIDGE_RUNTIME);

  const app = new BridgeApp({ port, dbPath, runtime });

  // Handle graceful shutdown
  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\nShutting down...');
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
