import type { RouteType } from "./route-selection.js";

export interface RouteDiagnostics {
  routeType: RouteType;
  endpoint: string;
  latencyMs: number;
  uptimeMs: number;
  reconnectCount: number;
  lastReconnectReason: string;
  messageDeliveryP95Ms: number;
  connectedAt: string;
}

const LATENCY_WINDOW = 10;

export class DiagnosticsTracker {
  private connectedAt: number = 0;
  private latencySamples: number[] = [];
  private reconnectCount = 0;
  private lastReconnectReason = "";
  private routeType: RouteType = "direct";
  private endpoint = "";

  startTracking(routeType: RouteType, endpoint: string): void {
    this.connectedAt = Date.now();
    this.routeType = routeType;
    this.endpoint = endpoint;
    this.latencySamples = [];
  }

  recordLatency(ms: number): void {
    this.latencySamples.push(ms);
    if (this.latencySamples.length > LATENCY_WINDOW) {
      this.latencySamples.shift();
    }
  }

  recordReconnect(reason: string): void {
    this.reconnectCount += 1;
    this.lastReconnectReason = reason;
  }

  getDiagnostics(): RouteDiagnostics | null {
    if (this.connectedAt === 0) return null;

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95 = sorted.length > 0 ? (sorted[Math.max(0, p95Index)] ?? 0) : 0;
    const avg = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;

    return {
      routeType: this.routeType,
      endpoint: this.endpoint,
      latencyMs: Math.round(avg),
      uptimeMs: Date.now() - this.connectedAt,
      reconnectCount: this.reconnectCount,
      lastReconnectReason: this.lastReconnectReason,
      messageDeliveryP95Ms: Math.round(p95),
      connectedAt: new Date(this.connectedAt).toISOString(),
    };
  }

  reset(): void {
    this.connectedAt = 0;
    this.latencySamples = [];
    this.reconnectCount = 0;
    this.lastReconnectReason = "";
  }
}
