/**
 * OpenCode Adapter - Main Entry Point
 * Exports adapter factory and core types.
 */

export { OpenCodeAdapter, createOpenCodeAdapter } from './opencode-adapter.js';
export { ServerManager } from './server-manager.js';
export { OpenCodeClient } from './opencode-client.js';
export { normalizeEvent, normalizeSessionStatus } from './normalization/event-normalizer.js';
export { generatePassword, createAuthHeader, createServerAuthInfo, type ServerAuthInfo } from './auth.js';

export type {
  RuntimeAdapter,
  AdapterEvent,
  ProbeResult,
  StartSessionParams,
  ReconcileResult,
} from '@agent-deck/adapter-contract';