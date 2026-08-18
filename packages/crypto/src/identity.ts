import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// React Native does not provide WebCrypto's SubtleCrypto implementation.
// Configure noble's synchronous hashing path so identity operations remain
// portable without weakening the Ed25519 implementation or requiring a
// platform-specific crypto shim.
ed.etc.sha512Sync = (...messages) => sha512(ed.etc.concatBytes(...messages));

export interface IdentityKeyPair {
  publicKeyBase64: string;
  privateKeyBase64: string;
}

/**
 * Generate an ed25519 identity key pair.
 * Returns base64-encoded public and private keys.
 */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);

  return {
    publicKeyBase64: uint8ToBase64(publicKey),
    privateKeyBase64: uint8ToBase64(privateKey),
  };
}

/**
 * Sign a message with an ed25519 private key (base64-encoded).
 */
export async function sign(
  message: Uint8Array,
  privateKeyBase64: string,
): Promise<Uint8Array> {
  const privateKey = base64ToUint8(privateKeyBase64);
  return ed.sign(message, privateKey);
}

/**
 * Verify an ed25519 signature.
 */
export async function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKeyBase64: string,
): Promise<boolean> {
  const publicKey = base64ToUint8(publicKeyBase64);
  return ed.verify(signature, message, publicKey);
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Node.js + React Native both have Buffer
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // Fallback for environments without Buffer
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export { uint8ToBase64, base64ToUint8 };
