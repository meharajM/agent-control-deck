import { x25519, edwardsToMontgomeryPub, edwardsToMontgomeryPriv } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { base64ToUint8, uint8ToBase64 } from './identity.js';

const SALT = 'agent-deck-session-v1';
const INFO = 'ucp-frame-encryption';

export interface SessionKeyMaterial {
  sessionKeyBase64: string;
  sharedSecretBase64: string;
}

/**
 * Derive a shared secret via X25519 ECDH, then derive a session key via HKDF-SHA256.
 * Converts ed25519 keys to x25519 (Montgomery) for ECDH.
 */
export function deriveSessionKey(
  edPrivateKeyBase64: string,
  edPeerPublicKeyBase64: string,
): SessionKeyMaterial {
  const edPrivateKey = base64ToUint8(edPrivateKeyBase64);
  const edPeerPublicKey = base64ToUint8(edPeerPublicKeyBase64);

  // Convert ed25519 keys to x25519 (Montgomery curve) for ECDH
  const xPrivateKey = edwardsToMontgomeryPriv(edPrivateKey);
  const xPeerPublicKey = edwardsToMontgomeryPub(edPeerPublicKey);

  const sharedSecret = x25519.getSharedSecret(xPrivateKey, xPeerPublicKey);

  const derivedKey = hkdf(sha256, sharedSecret, SALT, INFO, 32);

  return {
    sessionKeyBase64: uint8ToBase64(derivedKey),
    sharedSecretBase64: uint8ToBase64(sharedSecret),
  };
}
