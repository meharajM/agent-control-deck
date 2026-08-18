import { describe, expect, it } from 'vitest';
import { parseBridgeDevMode, parseBridgeRuntime } from '../runtime-selection.js';

describe('parseBridgeRuntime', () => {
  it('accepts supported runtime selectors', () => {
    expect(parseBridgeRuntime(undefined)).toBe('fake');
    expect(parseBridgeRuntime('fake')).toBe('fake');
    expect(parseBridgeRuntime('codex')).toBe('codex');
    expect(parseBridgeRuntime('opencode')).toBe('opencode');
  });

  it('rejects unsupported runtime selectors', () => {
    expect(() => parseBridgeRuntime('claude')).toThrow(
      'Unsupported BRIDGE_RUNTIME "claude". Expected one of: fake, codex, opencode',
    );
  });
});

describe('parseBridgeDevMode', () => {
  it('enables explicit legacy transport for local development', () => {
    expect(parseBridgeDevMode('true')).toBe(true);
    expect(parseBridgeDevMode('1')).toBe(true);
  });

  it('keeps secure transport enabled by default', () => {
    expect(parseBridgeDevMode(undefined)).toBe(false);
    expect(parseBridgeDevMode('false')).toBe(false);
    expect(parseBridgeDevMode('TRUE')).toBe(false);
  });
});
