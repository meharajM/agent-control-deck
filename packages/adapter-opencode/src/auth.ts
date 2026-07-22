/**
 * Authentication utilities for OpenCode server.
 * Generates secure passwords and creates auth headers.
 * // ponytail: minimal crypto, Node stdlib only
 */

import { randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically secure random password for OpenCode server.
 * 32 bytes = 43 chars base64url, sufficient for local loopback auth.
 */
export function generatePassword(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Create Basic Auth header value for OpenCode server.
 * Username is always 'opencode', password is the generated secret.
 */
export function createAuthHeader(password: string): string {
  const credentials = `opencode:${password}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Parse server info from ServerManager into client config.
 */
export interface ServerAuthInfo {
  baseUrl: string;
  authHeader: string;
  password: string;
}

export function createServerAuthInfo(
  host: string,
  port: number,
  password: string
): ServerAuthInfo {
  const baseUrl = `http://${host}:${port}`;
  const authHeader = createAuthHeader(password);
  return { baseUrl, authHeader, password };
}