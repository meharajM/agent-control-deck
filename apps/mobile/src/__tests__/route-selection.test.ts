import { describe, expect, it } from "vitest";
import {
  selectRoute,
  shouldFallbackToPrivate,
  shouldShowAllRoutesFailed,
  validatePrivateEndpoint,
} from "../services/route-selection.js";

describe("selectRoute", () => {
  it("returns null when no endpoints configured", () => {
    const result = selectRoute(
      { directEndpoint: null, privateEndpoint: null, lastSuccessfulRoute: null, lastNetworkId: null },
      0,
      0,
    );
    expect(result).toBeNull();
  });

  it("prefers previously successful route on current network", () => {
    const result = selectRoute(
      {
        directEndpoint: "ws://192.168.1.1:8765",
        privateEndpoint: "ws://100.64.0.1:8765",
        lastSuccessfulRoute: "ws://192.168.1.1:8765",
        lastNetworkId: "MyWifi",
      },
      0,
      0,
    );
    expect(result?.selectedEndpoint).toBe("ws://192.168.1.1:8765");
    expect(result?.routeType).toBe("direct");
  });

  it("falls back to direct when no memory", () => {
    const result = selectRoute(
      {
        directEndpoint: "ws://192.168.1.1:8765",
        privateEndpoint: "ws://100.64.0.1:8765",
        lastSuccessfulRoute: null,
        lastNetworkId: null,
      },
      0,
      0,
    );
    expect(result?.routeType).toBe("direct");
  });

  it("falls back to private after 3 direct failures", () => {
    const result = selectRoute(
      {
        directEndpoint: "ws://192.168.1.1:8765",
        privateEndpoint: "ws://100.64.0.1:8765",
        lastSuccessfulRoute: null,
        lastNetworkId: null,
      },
      3,
      0,
    );
    expect(result?.routeType).toBe("private");
    expect(result?.selectedEndpoint).toBe("ws://100.64.0.1:8765");
  });

  it("returns null when all routes exhausted", () => {
    const result = selectRoute(
      {
        directEndpoint: "ws://192.168.1.1:8765",
        privateEndpoint: "ws://100.64.0.1:8765",
        lastSuccessfulRoute: null,
        lastNetworkId: null,
      },
      3,
      3,
    );
    expect(result).toBeNull();
  });

  it("uses private when only private configured", () => {
    const result = selectRoute(
      {
        directEndpoint: null,
        privateEndpoint: "ws://100.64.0.1:8765",
        lastSuccessfulRoute: null,
        lastNetworkId: null,
      },
      0,
      0,
    );
    expect(result?.routeType).toBe("private");
  });
});

describe("shouldFallbackToPrivate", () => {
  it("returns false below threshold", () => {
    expect(shouldFallbackToPrivate(2)).toBe(false);
  });

  it("returns true at threshold", () => {
    expect(shouldFallbackToPrivate(3)).toBe(true);
  });
});

describe("shouldShowAllRoutesFailed", () => {
  it("returns false when private still available", () => {
    expect(shouldShowAllRoutesFailed(3, 1)).toBe(false);
  });

  it("returns true when both exhausted", () => {
    expect(shouldShowAllRoutesFailed(3, 3)).toBe(true);
  });
});

describe("validatePrivateEndpoint", () => {
  it("accepts valid host:port", () => {
    expect(validatePrivateEndpoint("100.64.0.1:8765")).toBeNull();
  });

  it("rejects missing port", () => {
    expect(validatePrivateEndpoint("100.64.0.1")).not.toBeNull();
  });

  it("rejects localhost", () => {
    expect(validatePrivateEndpoint("localhost:8765")).not.toBeNull();
  });

  it("rejects 127.0.0.1", () => {
    expect(validatePrivateEndpoint("127.0.0.1:8765")).not.toBeNull();
  });

  it("rejects 0.0.0.0", () => {
    expect(validatePrivateEndpoint("0.0.0.0:8765")).not.toBeNull();
  });

  it("rejects invalid port", () => {
    expect(validatePrivateEndpoint("10.0.0.1:99999")).not.toBeNull();
  });

  it("accepts hostname", () => {
    expect(validatePrivateEndpoint("my-tailscale-host:8765")).toBeNull();
  });
});
