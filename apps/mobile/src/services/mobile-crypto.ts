import "react-native-get-random-values";
import * as SecureStore from "expo-secure-store";
import {
  decryptFrame,
  deriveSessionKey,
  encryptFrame,
  generateIdentityKeyPair,
  type EncryptedFrame,
} from "@agent-deck/crypto";
import type { UcpClientCrypto } from "./ucp-client";

const PUBLIC_KEY = "agentdeck_device_public_key";
const PRIVATE_KEY = "agentdeck_device_private_key";

export function createMobileCrypto(): UcpClientCrypto {
  return {
    async generateKeyPair() {
      const [publicKeyBase64, privateKeyBase64] = await Promise.all([
        SecureStore.getItemAsync(PUBLIC_KEY),
        SecureStore.getItemAsync(PRIVATE_KEY),
      ]);
      if (publicKeyBase64 && privateKeyBase64) return { publicKeyBase64, privateKeyBase64 };

      const keys = await generateIdentityKeyPair();
      await Promise.all([
        SecureStore.setItemAsync(PUBLIC_KEY, keys.publicKeyBase64),
        SecureStore.setItemAsync(PRIVATE_KEY, keys.privateKeyBase64),
      ]);
      return keys;
    },
    deriveSessionKey(privateKeyBase64, peerPublicKeyBase64) {
      return deriveSessionKey(privateKeyBase64, peerPublicKeyBase64);
    },
    encryptFrame(envelope, sessionKeyBase64, sequence) {
      return encryptFrame(envelope, sessionKeyBase64, sequence);
    },
    decryptFrame(frame, sessionKeyBase64) {
      return decryptFrame(frame as EncryptedFrame, sessionKeyBase64);
    },
  };
}
