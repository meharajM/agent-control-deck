export type RouteType = "direct" | "private" | "relay";

export interface RouteConfig {
  directEndpoint: string | null;
  privateEndpoint: string | null;
  lastSuccessfulRoute: string | null;
  lastNetworkId: string | null;
}

export interface RouteSelection {
  selectedEndpoint: string;
  routeType: RouteType;
  reason: string;
}

const MAX_CONSECUTIVE_FAILURES = 3;

export function selectRoute(
  config: RouteConfig,
  consecutiveDirectFailures: number,
  consecutivePrivateFailures: number,
): RouteSelection | null {
  // 1. If we recently succeeded on this network, try that first
  if (config.lastSuccessfulRoute && config.lastNetworkId) {
    const isDirect = config.lastSuccessfulRoute === config.directEndpoint;
    const isPrivate = config.lastSuccessfulRoute === config.privateEndpoint;
    if (isDirect && consecutiveDirectFailures < MAX_CONSECUTIVE_FAILURES) {
      return {
        selectedEndpoint: config.lastSuccessfulRoute,
        routeType: "direct",
        reason: "Previously successful on this network",
      };
    }
    if (isPrivate && consecutivePrivateFailures < MAX_CONSECUTIVE_FAILURES) {
      return {
        selectedEndpoint: config.lastSuccessfulRoute,
        routeType: "private",
        reason: "Previously successful on this network",
      };
    }
  }

  // 2. Try direct LAN if not failing too much
  if (config.directEndpoint && consecutiveDirectFailures < MAX_CONSECUTIVE_FAILURES) {
    return {
      selectedEndpoint: config.directEndpoint,
      routeType: "direct",
      reason: "Direct LAN endpoint",
    };
  }

  // 3. Try private endpoint
  if (config.privateEndpoint && consecutivePrivateFailures < MAX_CONSECUTIVE_FAILURES) {
    return {
      selectedEndpoint: config.privateEndpoint,
      routeType: "private",
      reason: "Private network endpoint",
    };
  }

  // 4. Nothing reachable
  return null;
}

export function shouldFallbackToPrivate(consecutiveDirectFailures: number): boolean {
  return consecutiveDirectFailures >= MAX_CONSECUTIVE_FAILURES;
}

export function shouldShowAllRoutesFailed(
  consecutiveDirectFailures: number,
  consecutivePrivateFailures: number,
): boolean {
  return (
    consecutiveDirectFailures >= MAX_CONSECUTIVE_FAILURES &&
    consecutivePrivateFailures >= MAX_CONSECUTIVE_FAILURES
  );
}

export function validatePrivateEndpoint(endpoint: string): string | null {
  // Must be host:port format
  const match = endpoint.match(/^(.+):(\d+)$/);
  if (!match) return "Must be in host:port format (e.g., 100.64.0.1:8765)";

  const host = match[1];
  const port = Number(match[2]);

  if (port < 1 || port > 65535) return "Port must be between 1 and 65535";

  // Reject localhost/loopback — that's direct
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "Cannot use localhost — that is a direct connection";
  }

  // Reject 0.0.0.0
  if (host === "0.0.0.0") return "Cannot bind to 0.0.0.0";

  return null;
}
