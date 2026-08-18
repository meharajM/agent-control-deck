export function normalizePairingCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function isValidPairingCode(value: string): boolean {
  return /^\d{4}$/.test(value);
}
