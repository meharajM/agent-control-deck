import { describe, it, expect } from 'vitest';
import { generateIdentityKeyPair, sign, verify } from '../identity.js';

describe('identity', () => {
  it('generates a valid ed25519 key pair', async () => {
    const keyPair = await generateIdentityKeyPair();

    expect(keyPair.publicKeyBase64).toBeTruthy();
    expect(keyPair.privateKeyBase64).toBeTruthy();
    // ed25519 public key is 32 bytes = 44 base64 chars
    expect(keyPair.publicKeyBase64.length).toBeGreaterThanOrEqual(40);
  });

  it('signs and verifies a message', async () => {
    const keyPair = await generateIdentityKeyPair();
    const message = new TextEncoder().encode('hello agent deck');

    const signature = await sign(message, keyPair.privateKeyBase64);
    const valid = await verify(signature, message, keyPair.publicKeyBase64);

    expect(valid).toBe(true);
  });

  it('rejects invalid signature', async () => {
    const keyPair1 = await generateIdentityKeyPair();
    const keyPair2 = await generateIdentityKeyPair();
    const message = new TextEncoder().encode('hello agent deck');

    const signature = await sign(message, keyPair1.privateKeyBase64);
    const valid = await verify(signature, message, keyPair2.publicKeyBase64);

    expect(valid).toBe(false);
  });

  it('generates unique key pairs', async () => {
    const kp1 = await generateIdentityKeyPair();
    const kp2 = await generateIdentityKeyPair();

    expect(kp1.publicKeyBase64).not.toBe(kp2.publicKeyBase64);
  });
});
