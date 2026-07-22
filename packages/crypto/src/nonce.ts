export interface NonceStore {
  /** Record nonce as used. Returns true if new, false if already seen. */
  record(nonce: string): boolean;
  /** Check if nonce has been seen. */
  has(nonce: string): boolean;
}

/**
 * Generate a random 16-byte nonce, base64-encoded.
 * Uses the Web Crypto API (available in Node 20+ and React Native).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Create an in-memory nonce store for replay detection.
 * ponytail: simple Set — production would use DB with TTL expiry
 */
export function createNonceStore(): NonceStore {
  const seen = new Set<string>();
  return {
    record(nonce: string): boolean {
      if (seen.has(nonce)) return false;
      seen.add(nonce);
      return true;
    },
    has(nonce: string): boolean {
      return seen.has(nonce);
    },
  };
}

/**
 * Validate that a nonce hasn't been used before.
 * Returns true if nonce has been used (replay detected).
 */
export function isNonceUsed(nonce: string, store: NonceStore): boolean {
  return store.has(nonce);
}
