/** Validate and normalize a manually entered bridge WebSocket URL. */
export function normalizeBridgeUrl(input: string): string | null {
  const value = input.trim();
  if (!value.startsWith("ws://") && !value.startsWith("wss://")) {
    return null;
  }

  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password) return null;
    if (url.port !== "" && (Number(url.port) < 1 || Number(url.port) > 65535)) {
      return null;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
