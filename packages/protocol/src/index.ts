export type {
  UcpEnvelope,
} from "./envelope.js";

export type {
  UcpCommandPayload,
} from "./command.js";

export type {
  UcpCapabilities,
  UcpApprovalCapabilities,
  UcpQuestionCapabilities,
  UcpPreviewCapabilities,
} from "./capabilities.js";

export {
  asMessageId,
  asHostId,
  asSessionId,
  asCommandId,
  asIdempotencyKey,
  asCorrelationId,
  asTimestamp,
} from "./types.js";
export type {
  MessageId,
  HostId,
  SessionId,
  CommandId,
  IdempotencyKey,
  CorrelationId,
  Timestamp,
} from "./types.js";

export {
  UcpEnvelopeSchema,
  UcpCommandPayloadSchema,
  UcpCapabilitiesSchema,
} from "./validate.js";
export type {
  UcpEnvelopeInput,
  UcpCommandPayloadInput,
  UcpCapabilitiesInput,
} from "./validate.js";
