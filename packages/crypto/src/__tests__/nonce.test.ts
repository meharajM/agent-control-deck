import { describe, it, expect } from 'vitest';
import { generateNonce, createNonceStore, isNonceUsed } from '../nonce.js';

describe('nonce', () => {
  it('generates a base64 nonce', () => {
    const nonce = generateNonce();
    expect(nonce).toBeTruthy();
    // 16 bytes = 24 base64 chars (with padding)
    expect(nonce.length).toBeGreaterThanOrEqual(20);
  });

  it('generates unique nonces', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });

  it('nonce store detects first use', () => {
    const store = createNonceStore();
    const nonce = generateNonce();

    expect(store.record(nonce)).toBe(true);
    expect(store.has(nonce)).toBe(true);
  });

  it('nonce store rejects duplicate', () => {
    const store = createNonceStore();
    const nonce = generateNonce();

    store.record(nonce);
    expect(store.record(nonce)).toBe(false);
    expect(isNonceUsed(nonce, store)).toBe(true);
  });

  it('different nonces are independent', () => {
    const store = createNonceStore();
    const n1 = generateNonce();
    const n2 = generateNonce();

    store.record(n1);
    expect(store.has(n1)).toBe(true);
    expect(store.has(n2)).toBe(false);
  });
});
