import { randomUUID } from 'node:crypto';
import { generateNonce } from '@agent-deck/crypto';

interface Statement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface PairingDatabase {
  prepare(sql: string): Statement;
  transaction<T>(fn: () => T): () => T;
}

export interface DeviceGrant {
  deviceId: string;
  devicePublicKey: string;
  deviceName: string;
  pairedAt: string;
  scope: 'control';
}

export interface PairingSession {
  nonce: string;
  hostPublicKey: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

/**
 * Bridge-side pairing service.
 * Manages device grants, pairing sessions, and revocation.
 */
export class PairingService {
  constructor(private readonly db: PairingDatabase) {}

  /**
   * Create a new pairing session with a one-time nonce.
   */
  createPairingSession(hostPublicKey: string): PairingSession {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const session: PairingSession = {
      nonce: generateNonce(),
      hostPublicKey,
      createdAt,
      expiresAt,
      usedAt: null,
    };
    this.db
      .prepare(
        `INSERT INTO pairing_sessions (nonce, host_public_key, created_at, expires_at, used_at)
         VALUES (?, ?, ?, ?, NULL)`
      )
      .run(session.nonce, session.hostPublicKey, session.createdAt, session.expiresAt);
    return session;
  }

  /**
   * Complete pairing: validate nonce, store device grant.
   * Returns the grant if successful, throws on failure.
   */
  completePairing(
    devicePublicKey: string,
    deviceName: string,
    nonce: string,
  ): DeviceGrant {
    const transaction = this.db.transaction(() => {
      const session = this.db
        .prepare(
          `SELECT nonce, host_public_key, created_at, expires_at, used_at
           FROM pairing_sessions
           WHERE nonce = ?`
        )
        .get(nonce) as
        | {
            nonce: string;
            host_public_key: string;
            created_at: string;
            expires_at: string;
            used_at: string | null;
          }
        | undefined;

      if (!session) {
        throw new Error('Invalid pairing nonce');
      }
      if (session.used_at) {
        throw new Error('Nonce already used (replay detected)');
      }
      if (new Date(session.expires_at).getTime() < Date.now()) {
        throw new Error('Pairing session expired');
      }

      const existing = this.db
        .prepare(
          `SELECT id, name, public_key, status, paired_at
           FROM devices
           WHERE public_key = ?`
        )
        .get(devicePublicKey) as
        | {
            id: string;
            name: string;
            public_key: string;
            status: 'active' | 'revoked';
            paired_at: string;
          }
        | undefined;

      if (existing?.status === 'revoked') {
        throw new Error('This device has been revoked and cannot re-pair');
      }

      const pairedAt = existing?.paired_at ?? new Date().toISOString();
      const deviceId = existing?.id ?? randomUUID();
      const grantJson = JSON.stringify({ scope: 'control' });

      if (existing) {
        this.db
          .prepare(
            `UPDATE devices
             SET name = ?, grant_json = ?, status = 'active', last_seen_at = ?, revoked_at = NULL
             WHERE id = ?`
          )
          .run(deviceName, grantJson, pairedAt, deviceId);
      } else {
        this.db
          .prepare(
            `INSERT INTO devices (
               id, name, platform, public_key, grant_json, status, paired_at, last_seen_at, revoked_at
             ) VALUES (?, ?, NULL, ?, ?, 'active', ?, ?, NULL)`
          )
          .run(deviceId, deviceName, devicePublicKey, grantJson, pairedAt, pairedAt);
      }

      const usedAt = new Date().toISOString();
      this.db
        .prepare(`UPDATE pairing_sessions SET used_at = ? WHERE nonce = ?`)
        .run(usedAt, nonce);
      this.insertAuditEvent('pairing.completed', deviceId, {
        deviceName,
      });

      return {
        deviceId,
        devicePublicKey,
        deviceName,
        pairedAt,
        scope: 'control' as const,
      };
    });

    return transaction();
  }

  /**
   * Validate that a device has an active (non-revoked) grant.
   */
  validateDevice(devicePublicKey: string): DeviceGrant | null {
    const row = this.db
      .prepare(
        `SELECT id, name, public_key, grant_json, status, paired_at
         FROM devices
         WHERE public_key = ?`
      )
      .get(devicePublicKey) as
      | {
          id: string;
          name: string;
          public_key: string;
          grant_json: string;
          status: 'active' | 'revoked';
          paired_at: string;
        }
      | undefined;

    if (!row || row.status !== 'active') {
      return null;
    }

    this.db
      .prepare(`UPDATE devices SET last_seen_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), row.id);

    const grant = JSON.parse(row.grant_json) as { scope?: 'control' };
    return {
      deviceId: row.id,
      devicePublicKey: row.public_key,
      deviceName: row.name,
      pairedAt: row.paired_at,
      scope: grant.scope ?? 'control',
    };
  }

  /**
   * Revoke a device by its public key.
   * Returns true if revoked, false if not found.
   */
  revokeDevice(devicePublicKey: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE devices
         SET status = 'revoked', revoked_at = ?
         WHERE public_key = ? AND status != 'revoked'`
      )
      .run(new Date().toISOString(), devicePublicKey);

    if (result.changes > 0) {
      const device = this.db
        .prepare(`SELECT id FROM devices WHERE public_key = ?`)
        .get(devicePublicKey) as { id: string } | undefined;
      this.insertAuditEvent('pairing.revoked', device?.id ?? null, {});
      return true;
    }

    return false;
  }

  /**
   * List all active (non-revoked) device grants.
   */
  listDevices(): DeviceGrant[] {
    const rows = this.db
      .prepare(
        `SELECT id, name, public_key, grant_json, paired_at
         FROM devices
         WHERE status = 'active'
         ORDER BY paired_at ASC`
      )
      .all() as Array<{
        id: string;
        name: string;
        public_key: string;
        grant_json: string;
        paired_at: string;
      }>;

    return rows.map((row) => {
      const grant = JSON.parse(row.grant_json) as { scope?: 'control' };
      return {
        deviceId: row.id,
        devicePublicKey: row.public_key,
        deviceName: row.name,
        pairedAt: row.paired_at,
        scope: grant.scope ?? 'control',
      };
    });
  }

  /**
   * Check if a device's public key has been revoked.
   */
  isRevoked(devicePublicKey: string): boolean {
    const row = this.db
      .prepare(`SELECT status FROM devices WHERE public_key = ?`)
      .get(devicePublicKey) as { status: 'active' | 'revoked' } | undefined;
    return row?.status === 'revoked';
  }

  private insertAuditEvent(
    type: string,
    deviceId: string | null,
    metadata: Record<string, unknown>,
  ): void {
    this.db
      .prepare(
        `INSERT INTO audit_events (id, device_id, session_id, type, metadata_json, created_at)
         VALUES (?, ?, NULL, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        deviceId,
        type,
        JSON.stringify(metadata),
        new Date().toISOString(),
      );
  }
}
