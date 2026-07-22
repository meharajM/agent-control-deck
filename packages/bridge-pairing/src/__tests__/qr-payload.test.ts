import { describe, it, expect } from 'vitest';
import { encodeQrPayload, decodeQrPayload, createQrPayload } from '../qr-payload.js';

describe('qr-payload', () => {
  it('creates and encodes a valid QR payload', () => {
    const payload = createQrPayload({
      hostId: 'host_abc123',
      hostName: 'My Mac',
      hostPublicKey: 'dGVzdHB1YmxpY2tleQ==',
      endpoints: ['ws://192.168.1.42:8765'],
    });

    expect(payload.v).toBe(1);
    expect(payload.hostId).toBe('host_abc123');
    expect(payload.hostName).toBe('My Mac');
    expect(payload.nonce).toBeTruthy();
    expect(payload.endpoints).toEqual(['ws://192.168.1.42:8765']);
    expect(payload.expiresAt).toBeTruthy();

    const encoded = encodeQrPayload(payload);
    const parsed = JSON.parse(encoded);
    expect(parsed.hostId).toBe('host_abc123');
  });

  it('decodes a valid QR payload round-trip', () => {
    const payload = createQrPayload({
      hostId: 'host_xyz',
      hostName: 'Dev Laptop',
      hostPublicKey: 'cHVibGlja2V5',
      endpoints: ['ws://10.0.0.1:8765'],
    });

    const encoded = encodeQrPayload(payload);
    const decoded = decodeQrPayload(encoded);

    expect(decoded.v).toBe(1);
    expect(decoded.hostId).toBe('host_xyz');
    expect(decoded.hostName).toBe('Dev Laptop');
    expect(decoded.hostPublicKey).toBe('cHVibGlja2V5');
    expect(decoded.endpoints).toEqual(['ws://10.0.0.1:8765']);
  });

  it('rejects expired QR payload', () => {
    const expiredPayload = {
      v: 1,
      hostId: 'host_old',
      hostName: 'Old',
      hostPublicKey: 'key',
      nonce: 'nonce',
      endpoints: ['ws://1.2.3.4:8765'],
      expiresAt: '2020-01-01T00:00:00Z',
    };

    const encoded = JSON.stringify(expiredPayload);
    expect(() => decodeQrPayload(encoded)).toThrow('expired');
  });

  it('rejects invalid JSON', () => {
    expect(() => decodeQrPayload('not json')).toThrow('not valid JSON');
  });

  it('rejects missing fields', () => {
    expect(() => decodeQrPayload(JSON.stringify({ v: 1 }))).toThrow('missing');
  });

  it('rejects wrong version', () => {
    const payload = {
      v: 2,
      hostId: 'h',
      hostName: 'n',
      hostPublicKey: 'k',
      nonce: 'n',
      endpoints: ['ws://x:1'],
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    expect(() => decodeQrPayload(JSON.stringify(payload))).toThrow('unsupported version');
  });
});
