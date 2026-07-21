import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RuntimeAdapter } from '@agent-deck/adapter-contract';
import { FakeAdapter } from '@agent-deck/adapter-fake';
import { Database } from '@agent-deck/bridge-database';
import { EventJournal, CommandLedger, ApprovalService, QuestionService, SnapshotService } from '@agent-deck/bridge-core';
import { asHostId } from '@agent-deck/protocol';
import { generateIdentityKeyPair, type IdentityKeyPair } from '@agent-deck/crypto';
import { BridgePairingStore, type BridgeQrPayload } from './pairing-support.js';
import { AdapterManager } from './adapter-manager.js';
import type { BridgeRuntimeSelection } from './runtime-selection.js';
import { UcpGateway } from './ucp-gateway.js';
import { BRIDGE_RUNTIME_OPTIONS } from './runtime-selection.js';

export interface BridgeAppConfig {
  port: number;
  dbPath: string;
  /** Network interface to bind to (e.g., "en0", "eth0", "127.0.0.1"). If not set, binds to 0.0.0.0. */
  interface?: string;
  allowInsecureLegacyMode?: boolean;
  runtime?: BridgeRuntimeSelection;
  createAdapter?: (runtime: BridgeRuntimeSelection) => RuntimeAdapter | Promise<RuntimeAdapter>;
}

interface PersistedHostIdentity extends IdentityKeyPair {
  hostId: string;
  createdAt: string;
}

export class BridgeApp {
  private db: Database | null = null;
  private journal: EventJournal | null = null;
  private commandLedger: CommandLedger | null = null;
  private approvals: ApprovalService | null = null;
  private questions: QuestionService | null = null;
  private snapshots: SnapshotService | null = null;
  private adapterManager: AdapterManager | null = null;
  private gateway: UcpGateway | null = null;
  private pairing: BridgePairingStore | null = null;
  private hostIdentity: PersistedHostIdentity | null = null;
  hostId = asHostId(randomUUID());
  readonly runtime: BridgeRuntimeSelection;

  constructor(private readonly config: BridgeAppConfig) {
    this.runtime = config.runtime ?? 'fake';
  }

  async start(): Promise<void> {
    this.db = new Database(this.config.dbPath);

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = join(__dirname, '..', '..', '..', 'db', 'migrations');
    await this.db.runMigrations(migrationsDir);
    this.hostIdentity = await this.loadOrCreateHostIdentity();
    this.hostId = asHostId(this.hostIdentity.hostId);
    this.pairing = new BridgePairingStore(this.db.db);

    this.journal = new EventJournal(this.db.db);
    this.commandLedger = new CommandLedger(this.db.db);
    this.approvals = new ApprovalService(this.db.db);
    this.questions = new QuestionService(this.db.db);
    this.snapshots = new SnapshotService(this.db.db);

    this.adapterManager = new AdapterManager({
      db: this.db.db,
      journal: this.journal,
      approvals: this.approvals,
      questions: this.questions,
      broadcast: (envelope) => this.gateway?.broadcast(envelope),
      hostId: this.hostId,
    });

    const bindHost = this.resolveBindHost();
    const allowInsecureLegacyMode = this.config.allowInsecureLegacyMode ?? false;
    const secureMode = !allowInsecureLegacyMode;

    this.gateway = new UcpGateway({
      port: this.config.port,
      host: bindHost,
      hostId: this.hostId,
      hostName: 'Agent Deck Bridge',
      commandLedger: this.commandLedger,
      resolveAdapter: (sessionId) =>
        sessionId
          ? this.adapterManager?.getAdapterForSession(sessionId)
          : this.adapterManager?.getSelectedAdapter(),
      registerSession: (sessionId) => this.adapterManager?.recordSessionStart(sessionId),
      snapshots: this.snapshots!,
      journal: this.journal!,
      db: this.db.db,
      ...(secureMode
        ? {
            hostPublicKey: this.hostIdentity.publicKeyBase64,
            hostPrivateKey: this.hostIdentity.privateKeyBase64,
            validateDevice: (devicePublicKey: string) =>
              this.pairing?.validateDevice(devicePublicKey) ?? null,
            completePairing: (devicePublicKey: string, deviceName: string, pairingNonce: string) =>
              this.pairing?.completePairing(devicePublicKey, deviceName, pairingNonce) ?? null,
            isDeviceRevoked: (devicePublicKey: string) =>
              this.pairing?.isRevoked(devicePublicKey) ?? false,
          }
        : {
            allowInsecureLegacyMode: true,
          }),
    });

    await this.adapterManager.registerAdapter(this.runtime, await this.createAdapter(this.runtime));
    await this.gateway.start();

    if (bindHost === '0.0.0.0') {
      console.warn(
        '[bridge] WARNING: Binding to 0.0.0.0 exposes the WebSocket on all interfaces. ' +
        'Set BRIDGE_INTERFACE to a specific interface for private-network mode.'
      );
    }
  }

  private resolveBindHost(): string {
    const iface = this.config.interface ?? process.env.BRIDGE_INTERFACE;
    if (!iface) return '0.0.0.0';

    // If it looks like an IP address, use it directly
    if (/^\d+\.\d+\.\d+\.\d+$/.test(iface) || iface === '::1' || iface === 'localhost') {
      return iface;
    }

    // ponytail: stub — real impl would use os.networkInterfaces() to resolve
    // interface name (en0, eth0) to its IP address. For now, use the raw value
    // and let ws server handle it — it'll throw if invalid.
    console.warn(`[bridge] Interface binding to "${iface}" — resolve to IP in production`);
    return iface;
  }

  stop(): void {
    this.gateway?.stop();
    this.adapterManager?.dispose();
    this.db?.close();
    this.gateway = null;
    this.adapterManager = null;
    this.pairing = null;
    this.hostIdentity = null;
    this.db = null;
  }

  getGateway(): UcpGateway | null {
    return this.gateway;
  }

  getAdapterManager(): AdapterManager | null {
    return this.adapterManager;
  }

  getHostIdentity(): PersistedHostIdentity | null {
    return this.hostIdentity;
  }

  createPairingQrPayload(endpoints: string[], hostName = 'Agent Deck Bridge'): BridgeQrPayload {
    if (!this.pairing || !this.hostIdentity) {
      throw new Error('Bridge has not started');
    }

    return this.pairing.createQrPayload(
      this.hostId,
      hostName,
      this.hostIdentity.publicKeyBase64,
      endpoints,
    );
  }

  revokeDevice(devicePublicKey: string): boolean {
    if (!this.pairing) {
      throw new Error('Bridge has not started');
    }

    const revoked = this.pairing.revokeDevice(devicePublicKey);
    if (revoked) {
      this.gateway?.disconnectDevice(devicePublicKey, 'Device revoked');
    }
    return revoked;
  }

  private async loadOrCreateHostIdentity(): Promise<PersistedHostIdentity> {
    const row = this.db!.db
      .prepare(
        `SELECT value_json
         FROM bridge_metadata
         WHERE key = ?`
      )
      .get('host_identity') as { value_json: string } | undefined;

    if (row) {
      const identity = JSON.parse(row.value_json) as PersistedHostIdentity;
      return identity;
    }

    const keys = await generateIdentityKeyPair();
    const identity: PersistedHostIdentity = {
      hostId: randomUUID(),
      publicKeyBase64: keys.publicKeyBase64,
      privateKeyBase64: keys.privateKeyBase64,
      createdAt: new Date().toISOString(),
    };

    this.db!.db
      .prepare(
        `INSERT INTO bridge_metadata (key, value_json, updated_at)
         VALUES (?, ?, ?)`
      )
      .run('host_identity', JSON.stringify(identity), new Date().toISOString());

    return identity;
  }

  private async createAdapter(runtime: BridgeRuntimeSelection): Promise<RuntimeAdapter> {
    if (this.config.createAdapter) {
      return await this.config.createAdapter(runtime);
    }

    switch (runtime) {
      case 'fake':
        return new FakeAdapter();
      case 'codex': {
        const { CodexAdapter } = await import('../../../packages/adapter-codex/dist/index.js');
        return new CodexAdapter();
      }
      case 'opencode': {
        const { OpenCodeAdapter } = await import('../../../packages/adapter-opencode/dist/index.js');
        return new OpenCodeAdapter();
      }
    }
  }
}
