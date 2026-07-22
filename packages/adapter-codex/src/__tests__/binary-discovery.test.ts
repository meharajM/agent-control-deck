import { describe, it, expect } from 'vitest';

describe('binary-discovery', () => {
  it('probeCodex returns available=false when binary not found', async () => {
    const { probeCodex } = await import('../binary-discovery.js');
    const originalEnv = process.env.PATH;
    process.env.PATH = '/nonexistent/path';
    
    const result = await probeCodex();
    expect(result.available).toBe(false);
    expect(result.error).toContain('not found');
    
    process.env.PATH = originalEnv;
  });

  it('getCodexVersion returns null for non-existent binary', async () => {
    const { getCodexVersion } = await import('../binary-discovery.js');
    const version = await getCodexVersion('/nonexistent/codex');
    expect(version).toBeNull();
  });
});