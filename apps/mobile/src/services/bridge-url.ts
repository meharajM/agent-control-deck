/** Validate and normalize a manually entered bridge WebSocket URL. */
export function normalizeBridgeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const scheme = value.match(/^([a-z][a-z\d+.-]*):\/\//i)?.[1]?.toLowerCase();
  if (scheme && scheme !== "ws" && scheme !== "wss") return null;

  // Make the manual field friendly to people entering the common
  // `192.168.1.20:8765` form while still only allowing WebSocket URLs.
  const candidate = value.startsWith("ws://") || value.startsWith("wss://")
    ? value
    : `ws://${value}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return null;
    if (!url.hostname || url.username || url.password) return null;
    if (url.port !== "" && (Number(url.port) < 1 || Number(url.port) > 65535)) {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
