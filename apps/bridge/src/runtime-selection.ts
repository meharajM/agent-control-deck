export const BRIDGE_RUNTIME_OPTIONS = ['fake', 'codex', 'opencode'] as const;
export type BridgeRuntimeSelection = (typeof BRIDGE_RUNTIME_OPTIONS)[number];

export function parseBridgeRuntime(value: string | undefined): BridgeRuntimeSelection {
  if (!value) {
    return 'fake';
  }

  if (BRIDGE_RUNTIME_OPTIONS.includes(value as BridgeRuntimeSelection)) {
    return value as BridgeRuntimeSelection;
  }

  throw new Error(
    `Unsupported BRIDGE_RUNTIME "${value}". Expected one of: ${BRIDGE_RUNTIME_OPTIONS.join(', ')}`
  );
}
