import { beforeEach, describe, expect, it } from 'vitest';
import { PairingService } from '../pairing-service.js';

describe('PairingService', () => {
  let db: ReturnType<typeof createFakeDb>;

  beforeEach(() => {
    db = createFakeDb();
  });

  it('creates a pairing session with a nonce', () => {
    const service = new PairingService(db);
    const session = service.createPairingSession('host-public-key');

    expect(session.nonce).toBeTruthy();
    expect(session.hostPublicKey).toBe('host-public-key');
    expect(session.usedAt).toBeNull();
  });

  it('completes pairing with valid nonce', () => {
    const service = new PairingService(db);
    const session = service.createPairingSession('host-key');

    const grant = service.completePairing('device-key', 'iPhone', session.nonce);

    expect(grant.deviceId).toBeTruthy();
    expect(grant.devicePublicKey).toBe('device-key');
    expect(grant.deviceName).toBe('iPhone');
    expect(grant.scope).toBe('control');
    expect(grant.pairedAt).toBeTruthy();
  });

  it('rejects reused nonce (replay)', () => {
    const service = new PairingService(db);
    const session = service.createPairingSession('host-key');

    service.completePairing('device-1', 'Phone', session.nonce);

    expect(() => service.completePairing('device-2', 'Other', session.nonce)).toThrow(
      'Nonce already used',
    );
  });

  it('rejects invalid nonce', () => {
    const service = new PairingService(db);
    expect(() => service.completePairing('device-key', 'Phone', 'bad-nonce')).toThrow(
      'Invalid pairing nonce',
    );
  });

  it('validates a paired device', () => {
    const service = new PairingService(db);
    const session = service.createPairingSession('host-key');
    service.completePairing('device-key', 'Phone', session.nonce);

    const grant = service.validateDevice('device-key');
    expect(grant).not.toBeNull();
    expect(grant!.deviceName).toBe('Phone');
  });

  it('returns null for unknown device', () => {
    const service = new PairingService(db);
    expect(service.validateDevice('unknown')).toBeNull();
  });

  it('revokes a device', () => {
    const service = new PairingService(db);
    const session = service.createPairingSession('host-key');
    service.completePairing('device-key', 'Phone', session.nonce);

    expect(service.revokeDevice('device-key')).toBe(true);
    expect(service.validateDevice('device-key')).toBeNull();
    expect(service.isRevoked('device-key')).toBe(true);
  });

  it('rejects revoked device from re-pairing', () => {
    const service = new PairingService(db);
    const session1 = service.createPairingSession('host-key');
    service.completePairing('device-key', 'Phone', session1.nonce);
    service.revokeDevice('device-key');

    const session2 = service.createPairingSession('host-key');
    expect(() => service.completePairing('device-key', 'Phone', session2.nonce)).toThrow(
      'revoked',
    );
  });

  it('lists active devices', () => {
    const service = new PairingService(db);
    const s1 = service.createPairingSession('h');
    service.completePairing('d1', 'Phone', s1.nonce);
    const s2 = service.createPairingSession('h');
    service.completePairing('d2', 'Tablet', s2.nonce);
    service.revokeDevice('d1');

    const devices = service.listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]!.deviceName).toBe('Tablet');
  });

  it('returns false when revoking unknown device', () => {
    const service = new PairingService(db);
    expect(service.revokeDevice('unknown')).toBe(false);
  });
});

function createFakeDb() {
  const pairingSessions = new Map<string, {
    nonce: string;
    host_public_key: string;
    created_at: string;
    expires_at: string;
    used_at: string | null;
  }>();
  const devices = new Map<string, {
    id: string;
    name: string;
    platform: string | null;
    public_key: string;
    grant_json: string;
    status: 'active' | 'revoked';
    paired_at: string;
    last_seen_at: string | null;
    revoked_at: string | null;
  }>();
  const auditEvents: Array<Record<string, unknown>> = [];

  return {
    transaction<T>(fn: () => T) {
      return fn;
    },
    prepare(sql: string) {
      if (sql.includes('INSERT INTO pairing_sessions')) {
        return {
          run(nonce: string, hostPublicKey: string, createdAt: string, expiresAt: string) {
            pairingSessions.set(nonce, {
              nonce,
              host_public_key: hostPublicKey,
              created_at: createdAt,
              expires_at: expiresAt,
              used_at: null,
            });
            return { changes: 1 };
          },
          get() {
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('FROM pairing_sessions')) {
        return {
          run() {
            return { changes: 0 };
          },
          get(nonce: string) {
            return pairingSessions.get(nonce);
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('UPDATE pairing_sessions SET used_at')) {
        return {
          run(usedAt: string, nonce: string) {
            const session = pairingSessions.get(nonce);
            if (!session) return { changes: 0 };
            session.used_at = usedAt;
            return { changes: 1 };
          },
          get() {
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('SELECT id, name, public_key, status, paired_at')) {
        return {
          run() {
            return { changes: 0 };
          },
          get(devicePublicKey: string) {
            for (const device of devices.values()) {
              if (device.public_key === devicePublicKey) {
                return {
                  id: device.id,
                  name: device.name,
                  public_key: device.public_key,
                  status: device.status,
                  paired_at: device.paired_at,
                };
              }
            }
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('SELECT id, name, public_key, grant_json, status, paired_at')) {
        return {
          run() {
            return { changes: 0 };
          },
          get(devicePublicKey: string) {
            for (const device of devices.values()) {
              if (device.public_key === devicePublicKey) {
                return device;
              }
            }
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('INSERT INTO devices')) {
        return {
          run(
            id: string,
            name: string,
            publicKey: string,
            grantJson: string,
            pairedAt: string,
            lastSeenAt: string,
          ) {
            devices.set(id, {
              id,
              name,
              platform: null,
              public_key: publicKey,
              grant_json: grantJson,
              status: 'active',
              paired_at: pairedAt,
              last_seen_at: lastSeenAt,
              revoked_at: null,
            });
            return { changes: 1 };
          },
          get() {
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes(`UPDATE devices
             SET name = ?, grant_json = ?, status = 'active', last_seen_at = ?, revoked_at = NULL`)) {
        return {
          run(name: string, grantJson: string, lastSeenAt: string, id: string) {
            const device = devices.get(id);
            if (!device) return { changes: 0 };
            device.name = name;
            device.grant_json = grantJson;
            device.status = 'active';
            device.last_seen_at = lastSeenAt;
            device.revoked_at = null;
            return { changes: 1 };
          },
          get() {
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('UPDATE devices SET last_seen_at = ?')) {
        return {
          run(lastSeenAt: string, id: string) {
            const device = devices.get(id);
            if (!device) return { changes: 0 };
            device.last_seen_at = lastSeenAt;
            return { changes: 1 };
          },
          get() {
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes(`UPDATE devices
         SET status = 'revoked', revoked_at = ?`)) {
        return {
          run(revokedAt: string, devicePublicKey: string) {
            for (const device of devices.values()) {
              if (device.public_key === devicePublicKey && device.status !== 'revoked') {
                device.status = 'revoked';
                device.revoked_at = revokedAt;
                return { changes: 1 };
              }
            }
            return { changes: 0 };
          },
          get() {
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('SELECT id FROM devices WHERE public_key = ?')) {
        return {
          run() {
            return { changes: 0 };
          },
          get(devicePublicKey: string) {
            for (const device of devices.values()) {
              if (device.public_key === devicePublicKey) {
                return { id: device.id };
              }
            }
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('SELECT id, name, public_key, grant_json, paired_at')) {
        return {
          run() {
            return { changes: 0 };
          },
          get() {
            return undefined;
          },
          all() {
            return Array.from(devices.values())
              .filter((device) => device.status === 'active')
              .sort((a, b) => a.paired_at.localeCompare(b.paired_at))
              .map((device) => ({
                id: device.id,
                name: device.name,
                public_key: device.public_key,
                grant_json: device.grant_json,
                paired_at: device.paired_at,
              }));
          },
        };
      }

      if (sql.includes('SELECT status FROM devices WHERE public_key = ?')) {
        return {
          run() {
            return { changes: 0 };
          },
          get(devicePublicKey: string) {
            for (const device of devices.values()) {
              if (device.public_key === devicePublicKey) {
                return { status: device.status };
              }
            }
            return undefined;
          },
          all() {
            return [];
          },
        };
      }

      if (sql.includes('INSERT INTO audit_events')) {
        return {
          run(id: string, deviceId: string | null, type: string, metadataJson: string, createdAt: string) {
            auditEvents.push({
              id,
              device_id: deviceId,
              type,
              metadata_json: metadataJson,
              created_at: createdAt,
            });
            return { changes: 1 };
          },
          get() {
            return undefined;
          },
          all() {
            return auditEvents;
          },
        };
      }

      throw new Error(`Unhandled SQL in fake DB: ${sql}`);
    },
  };
}
