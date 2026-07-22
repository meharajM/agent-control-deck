import { gcm } from '@noble/ciphers/aes';
import { base64ToUint8, uint8ToBase64 } from './identity.js';

export interface EncryptedFrame {
  encrypted: true;
  sequence: number;
  nonce: string;
  ciphertext: string;
}

const FRAME_SIZE_LIMIT = 1024 * 1024; // 1 MiB JSON

/**
 * Encrypt a UCP envelope as an AES-256-GCM frame.
 * nonce is 12 bytes random, ciphertext = nonce || encrypted(JSON).
 */
export function encryptFrame(
  envelope: Record<string, unknown>,
  sessionKeyBase64: string,
  sequence: number,
): EncryptedFrame {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const nonceBase64 = uint8ToBase64(nonce);
  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      _meta: {
        sequence,
        nonce: nonceBase64,
      },
      envelope,
    }),
  );
  if (plaintext.byteLength > FRAME_SIZE_LIMIT) {
    throw new Error(`Frame too large: ${plaintext.byteLength} bytes (limit ${FRAME_SIZE_LIMIT})`);
  }

  const sessionKey = base64ToUint8(sessionKeyBase64);
  const cipher = gcm(sessionKey, nonce);
  const ciphertextBytes = cipher.encrypt(plaintext);

  // Prepend nonce to ciphertext for transmission
  const combined = new Uint8Array(nonce.length + ciphertextBytes.length);
  combined.set(nonce, 0);
  combined.set(ciphertextBytes, nonce.length);

  return {
    encrypted: true,
    sequence,
    nonce: nonceBase64,
    ciphertext: uint8ToBase64(combined),
  };
}

/**
 * Decrypt an encrypted UCP frame. Throws on tampered ciphertext or wrong key.
 */
export function decryptFrame(
  frame: EncryptedFrame,
  sessionKeyBase64: string,
): Record<string, unknown> {
  const sessionKey = base64ToUint8(sessionKeyBase64);
  const combined = base64ToUint8(frame.ciphertext);

  if (combined.length < 12) {
    throw new Error('Ciphertext too short');
  }

  const nonce = combined.slice(0, 12);
  const ciphertextBytes = combined.slice(12);

  const cipher = gcm(sessionKey, nonce);
  const plaintextBytes = cipher.decrypt(ciphertextBytes);

  const plaintext = new TextDecoder().decode(plaintextBytes);
  const parsed = JSON.parse(plaintext) as {
    _meta?: {
      sequence?: unknown;
      nonce?: unknown;
    };
    envelope?: Record<string, unknown>;
  };

  if (parsed._meta?.sequence !== frame.sequence) {
    throw new Error('Frame sequence mismatch');
  }
  if (parsed._meta?.nonce !== frame.nonce) {
    throw new Error('Frame nonce mismatch');
  }
  if (!parsed.envelope || typeof parsed.envelope !== 'object') {
    throw new Error('Missing frame envelope');
  }

  return parsed.envelope;
}
