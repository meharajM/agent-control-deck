/**
 * UCP session capabilities — derived from schemas/ucp-capabilities.schema.json.
 *
 * Mobile renders controls based on these boolean flags; it must NOT branch
 * on runtime name. The bridge publishes capabilities after a successful probe.
 */
export interface UcpApprovalCapabilities {
  readonly command: boolean;
  readonly fileChange: boolean;
  readonly network: boolean;
  readonly filesystem: boolean;
  readonly genericTool: boolean;
  readonly approveForSession: boolean;
  readonly modifyBeforeApproval: boolean;
}

export interface UcpQuestionCapabilities {
  readonly singleChoice: boolean;
  readonly multiSelect: boolean;
  readonly freeText: boolean;
}

export interface UcpPreviewCapabilities {
  readonly diff: boolean;
  readonly tests: boolean;
  readonly commands: boolean;
  readonly files: boolean;
  readonly rawTranscript: boolean;
}

export interface UcpCapabilities {
  /** Whether the session accepts new prompts. */
  readonly send: boolean;
  /** Whether in-flight steering is supported. */
  readonly steerInFlight: boolean;
  /** Whether the session can be cancelled. */
  readonly cancel: boolean;
  /** Whether retry is supported after failure. */
  readonly retry: boolean;
  /** Whether a session can be resumed after interruption. */
  readonly resume: boolean;
  /** Whether session forking is supported. */
  readonly fork: boolean;
  /** Whether the host can reliably focus the exact session in a desktop client. */
  readonly desktopFocus?: boolean;
  /** Granular approval action capabilities. */
  readonly approvals: UcpApprovalCapabilities;
  /** Question/answer interaction capabilities. */
  readonly questions: UcpQuestionCapabilities;
  /** Preview content capabilities. */
  readonly previews: UcpPreviewCapabilities;
  /** Named effort levels supported by the runtime (e.g. ["low","medium","high"]). */
  readonly effortLevels?: readonly string[];
  /** Whether saved skills/instructions are supported. */
  readonly skills: boolean;
  /** Whether macro playback is supported. */
  readonly macros: boolean;
}
