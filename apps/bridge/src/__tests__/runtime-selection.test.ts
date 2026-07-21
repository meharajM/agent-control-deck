import { describe, expect, it } from 'vitest';
import { parseBridgeRuntime } from '../runtime-selection.js';

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
