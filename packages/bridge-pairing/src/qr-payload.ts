import { generateNonce } from '@agent-deck/crypto';

export interface QrPayload {
  v: 1;
  hostId: string;
  hostName: string;
  hostPublicKey: string;
  nonce: string;
  endpoints: string[];
  expiresAt: string;
}

const QR_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a QR pairing payload.
 */
export function createQrPayload(opts: {
  hostId: string;
  hostName: string;
  hostPublicKey: string;
  endpoints: string[];
  nonce?: string;
  expiresAt?: string;
}): QrPayload {
  return {
    v: 1,
    hostId: opts.hostId,
    hostName: opts.hostName,
    hostPublicKey: opts.hostPublicKey,
    nonce: opts.nonce ?? generateNonce(),
    endpoints: opts.endpoints,
    expiresAt: opts.expiresAt ?? new Date(Date.now() + QR_EXPIRY_MS).toISOString(),
  };
}

/**
 * Encode a QR payload to a JSON string for QR rendering.
 */
export function encodeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

/**
 * Decode a scanned QR payload. Validates structure and expiry.
 * Throws on invalid format or expired payload.
 */
export function decodeQrPayload(data: string): QrPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error('Invalid QR payload: not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid QR payload: not an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.v !== 1) {
    throw new Error(`Invalid QR payload: unsupported version ${String(obj.v)}`);
  }
  if (typeof obj.hostId !== 'string' || !obj.hostId) {
    throw new Error('Invalid QR payload: missing hostId');
  }
  if (typeof obj.hostPublicKey !== 'string' || !obj.hostPublicKey) {
    throw new Error('Invalid QR payload: missing hostPublicKey');
  }
  if (typeof obj.nonce !== 'string' || !obj.nonce) {
    throw new Error('Invalid QR payload: missing nonce');
  }
  if (!Array.isArray(obj.endpoints) || obj.endpoints.length === 0) {
    throw new Error('Invalid QR payload: missing endpoints');
  }
  if (typeof obj.expiresAt !== 'string') {
    throw new Error('Invalid QR payload: missing expiresAt');
  }

  const expiresAt = new Date(obj.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error('Invalid QR payload: invalid expiresAt');
  }
  if (expiresAt.getTime() < Date.now()) {
    throw new Error('QR code has expired');
  }

  return {
    v: 1,
    hostId: obj.hostId,
    hostName: typeof obj.hostName === 'string' ? obj.hostName : '',
    hostPublicKey: obj.hostPublicKey,
    nonce: obj.nonce,
    endpoints: obj.endpoints as string[],
    expiresAt: obj.expiresAt,
  };
}
