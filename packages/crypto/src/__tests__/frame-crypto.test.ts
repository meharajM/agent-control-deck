import { describe, it, expect } from 'vitest';
import { encryptFrame, decryptFrame } from '../frame-crypto.js';
import { deriveSessionKey } from '../session-keys.js';
import { generateIdentityKeyPair } from '../identity.js';

describe('frame-crypto', () => {
  it('encrypts and decrypts round-trip', async () => {
    const hostKeys = await generateIdentityKeyPair();
    const deviceKeys = await generateIdentityKeyPair();

    const hostSession = deriveSessionKey(hostKeys.privateKeyBase64, deviceKeys.publicKeyBase64);
    const deviceSession = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);

    expect(hostSession.sessionKeyBase64).toBe(deviceSession.sessionKeyBase64);

    const envelope = { type: 'session.updated', payload: { id: 's1', state: 'running' } };
    const encrypted = encryptFrame(envelope, deviceSession.sessionKeyBase64, 1);

    expect(encrypted.encrypted).toBe(true);
    expect(encrypted.sequence).toBe(1);
    expect(encrypted.nonce).toBeTruthy();
    expect(encrypted.ciphertext).not.toBe(JSON.stringify(envelope));

    const decrypted = decryptFrame(encrypted, hostSession.sessionKeyBase64);
    expect(decrypted).toEqual(envelope);
  });

  it('fails decryption with wrong key', async () => {
    const hostKeys = await generateIdentityKeyPair();
    const deviceKeys = await generateIdentityKeyPair();
    const attackerKeys = await generateIdentityKeyPair();

    const deviceSession = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);
    const attackerSession = deriveSessionKey(attackerKeys.privateKeyBase64, hostKeys.publicKeyBase64);

    const envelope = { type: 'session.updated', payload: { id: 's1' } };
    const encrypted = encryptFrame(envelope, deviceSession.sessionKeyBase64, 1);

    expect(() => decryptFrame(encrypted, attackerSession.sessionKeyBase64)).toThrow();
  });

  it('detects tampered ciphertext', async () => {
    const hostKeys = await generateIdentityKeyPair();
    const deviceKeys = await generateIdentityKeyPair();

    const hostSession = deriveSessionKey(hostKeys.privateKeyBase64, deviceKeys.publicKeyBase64);
    const deviceSession = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);

    const envelope = { type: 'command/send', payload: { text: 'hello' } };
    const encrypted = encryptFrame(envelope, deviceSession.sessionKeyBase64, 1);

    // Tamper with ciphertext
    const bytes = Buffer.from(encrypted.ciphertext, 'base64');
    bytes[20] = bytes[20]! ^ 0xff;
    encrypted.ciphertext = bytes.toString('base64');

    expect(() => decryptFrame(encrypted, hostSession.sessionKeyBase64)).toThrow();
  });

  it('rejects frames that exceed size limit', async () => {
    const hostKeys = await generateIdentityKeyPair();
    const deviceKeys = await generateIdentityKeyPair();
    const session = deriveSessionKey(deviceKeys.privateKeyBase64, hostKeys.publicKeyBase64);

    const bigPayload = { data: 'x'.repeat(2 * 1024 * 1024) };
    expect(() => encryptFrame(bigPayload, session.sessionKeyBase64, 1)).toThrow('Frame too large');
  });
});
