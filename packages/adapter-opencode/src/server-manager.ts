/**
 * Manages the `opencode serve` subprocess lifecycle.
 * Starts server on random loopback port with generated password.
 * // ponytail: single responsibility - process management only
 */

import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import { generatePassword, createAuthHeader, createServerAuthInfo, type ServerAuthInfo } from './auth.js';

export interface ServerInfo extends ServerAuthInfo {
  port: number;
  host: string;
  process?: ChildProcess;
  managed: boolean;
}

export interface ServerManagerOptions {
  cwd?: string | undefined;
  env?: Record<string, string>;
  serverUrl?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
}

/**
 * Manages the OpenCode server process lifecycle.
 * Emits 'ready' when server responds to health check.
 * Emits 'error' if server fails to start or crashes.
 * Emits 'exit' when process terminates.
 */
export class ServerManager extends EventEmitter {
  private serverInfo: ServerInfo | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readonly options: ServerManagerOptions;

  constructor(options: ServerManagerOptions = {}) {
    super();
    this.options = options;
  }

  /**
   * Start the OpenCode server on a random available port.
   * Returns server info including auth credentials.
   */
  async start(): Promise<ServerInfo> {
    if (this.serverInfo) {
      throw new Error('Server already running');
    }

    const configuredUrl = this.options.serverUrl ?? process.env.OPENCODE_SERVER_URL;
    const username = this.options.username ?? process.env.OPENCODE_SERVER_USERNAME ?? 'opencode';

    if (configuredUrl) {
      const parsed = new URL(configuredUrl);
      const host = parsed.hostname;
      const port = Number(parsed.port || 80);
      const baseUrl = configuredUrl.replace(/\/$/, '');
      const password = this.options.password ?? process.env.OPENCODE_SERVER_PASSWORD ?? '';
      if (!password) {
        throw new Error('OPENCODE_SERVER_PASSWORD is required when attaching to an existing OpenCode server');
      }

      this.serverInfo = {
        ...createServerAuthInfo(host, port, password, username),
        baseUrl,
        port,
        host,
        managed: false,
      };
      await this.waitForReady();
      return this.serverInfo!;
    }

    const port = await this.findFreePort();
    const password = generatePassword();
    const authHeader = createAuthHeader(password, username);
    const host = '127.0.0.1';
    const baseUrl = `http://${host}:${port}`;

    const env: Record<string, string> = {
      ...process.env,
      ...this.options.env,
      OPENCODE_SERVER_USERNAME: username,
      OPENCODE_SERVER_PASSWORD: password,
    };

    const serverProcess = spawn('opencode', ['serve', '--hostname', host, '--port', String(port)], {
      cwd: this.options.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.serverInfo = { port, host, baseUrl, authHeader, password, username, process: serverProcess, managed: true };

    serverProcess.stdout?.on('data', (data: Buffer) => {
      this.emit('stdout', data.toString());
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString());
    });

    serverProcess.on('error', (err: Error) => {
      this.emit('error', err);
    });

    serverProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      this.serverInfo = null;
      this.emit('exit', { code, signal });
    });

    // Wait for server to be ready via health check
    await this.waitForReady();

    return this.serverInfo!;
  }

  /**
   * Stop the OpenCode server process.
   * Safe to call multiple times.
   */
  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    const serverProcess = this.serverInfo?.process;
    if (serverProcess) {
      serverProcess.kill('SIGTERM');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);

        serverProcess.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.serverInfo = null;
    } else {
      this.serverInfo = null;
    }
  }

  /**
   * Get current server info (only available after start).
   */
  getServerInfo(): ServerInfo | null {
    return this.serverInfo;
  }

  isExternalConfigured(): boolean {
    return Boolean(this.options.serverUrl ?? process.env.OPENCODE_SERVER_URL);
  }

  /**
   * Check if server process is running.
   */
  isRunning(): boolean {
    return this.serverInfo !== null;
  }

  /**
   * Find a free port on localhost.
   */
  private async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as { port: number }).port;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }

  /**
   * Poll health endpoint until server responds or timeout.
   */
  private async waitForReady(timeoutMs = 30000): Promise<void> {
    if (!this.serverInfo) throw new Error('Server not started');

    const { baseUrl, authHeader } = this.serverInfo;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`${baseUrl}/global/health`, {
          method: 'GET',
          headers: { Authorization: authHeader },
        });
        if (response.ok) {
          this.emit('ready');
          return;
        }
      } catch {
        // Server not ready yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    await this.stop();
    throw new Error(`OpenCode server failed to start within ${timeoutMs}ms`);
  }
}
