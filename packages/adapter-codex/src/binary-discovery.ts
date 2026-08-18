import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface CodexBinaryInfo {
  path: string;
  version: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function probeCodex(
  candidatePaths?: string[],
): Promise<{ available: boolean; path?: string; version?: string; error?: string }> {
  const candidates = candidatePaths ?? [
    'codex',
    join(__dirname, '..', '..', '..', '..', '.local', 'bin', 'codex'),
    '/usr/local/bin/codex',
    '/opt/homebrew/bin/codex',
    '/Applications/ChatGPT.app/Contents/Resources/codex',
  ];

  for (const bin of candidates) {
    try {
      const version = await getCodexVersion(bin);
      if (version) return { available: true, path: bin, version };
    } catch {}
  }
  return { available: false, error: 'Codex binary not found in PATH or known locations' };
}

export function getCodexVersion(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(bin, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout!.on('data', (d: Buffer) => (stdout += d.toString()));
    (child as unknown as EventEmitter).on('close', (code: number | null) => {
      if (code === 0 && stdout.trim()) resolve(stdout.trim());
      else resolve(null);
    });
    (child as unknown as EventEmitter).on('error', () => resolve(null));
  });
}

export function spawnCodexAppServer(bin: string): ChildProcess {
  const child = spawn(bin, ['app-server'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CODEX_APP_SERVER_TRANSPORT: 'stdio' },
  });
  return child;
}
