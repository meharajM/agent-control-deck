# Universal Control Protocol (UCP) v1

## 1. Purpose

UCP is the stable protocol between the mobile app and host bridge. It hides runtime-specific protocols and provides consistent authentication, capabilities, synchronization, commands, approvals, questions, and errors.

UCP is not MCP. MCP may be exposed as an optional interoperability surface, while UCP remains optimized for a paired intermittently connected mobile client.

## 2. Design properties

- Versioned
- Runtime neutral
- Capability negotiated
- Ordered per host
- At-least-once delivery safe
- Idempotent commands
- Resumable
- Snapshot capable
- Transport independent
- Strictly schema validated

## 3. Transport

V1 uses:

- Authenticated WebSocket
- JSON text frames
- Binary audio frames only for optional host transcription
- Maximum JSON frame: 1 MiB default
- Maximum binary audio frame: 64 KiB default

Large previews use chunked application messages or explicit paginated fetches rather than oversized events.

## 4. Connection lifecycle

```text
disconnected -> connecting -> authenticating -> synchronizing -> ready
```

The phone may issue state-changing commands only in `ready`.

## 5. Initialization

Phone request:

```json
{
  "type": "connection.initialize",
  "requestId": "req_01J...",
  "payload": {
    "supportedVersions": [1],
    "deviceId": "dev_01J...",
    "deviceName": "Phone",
    "platform": "ios",
    "appVersion": "0.1.0",
    "lastAcknowledgedSequence": 1842,
    "capabilities": {
      "voice": true,
      "binaryAudio": false,
      "biometrics": true,
      "pushNotifications": false
    }
  }
}
```

Bridge response:

```json
{
  "type": "connection.initialized",
  "requestId": "req_01J...",
  "payload": {
    "selectedVersion": 1,
    "hostId": "host_01J...",
    "hostName": "Development Mac",
    "bridgeVersion": "0.1.0",
    "currentSequence": 1881,
    "syncMode": "replay"
  }
}
```

## 6. Event envelope

```json
{
  "protocol": "ucp",
  "version": 1,
  "messageId": "msg_01J...",
  "type": "session.state_changed",
  "sequence": 1881,
  "timestamp": "2026-07-18T18:30:00.000Z",
  "hostId": "host_01J...",
  "sessionId": "ses_01J...",
  "correlationId": "cmd_01J...",
  "payload": {}
}
```

`sequence` is mandatory for durable bridge-to-phone events. Ephemeral connection messages may omit it.

## 7. Command envelope

```json
{
  "protocol": "ucp",
  "version": 1,
  "messageId": "msg_01J...",
  "type": "session.send",
  "timestamp": "2026-07-18T18:30:00.000Z",
  "hostId": "host_01J...",
  "sessionId": "ses_01J...",
  "payload": {
    "commandId": "cmd_01J...",
    "idempotencyKey": "idem_01J...",
    "expectedSessionVersion": 8,
    "input": {
      "kind": "text",
      "text": "Run the relevant tests and stop."
    }
  }
}
```

## 8. Commands

### Host

- `host.sync`
- `host.get_capabilities`
- `host.rename`
- `host.get_diagnostics`

### Session

- `session.list`
- `session.get`
- `session.create`
- `session.resume`
- `session.fork`
- `session.send`
- `session.steer`
- `session.cancel`
- `session.retry`
- `session.archive`
- `session.request_preview`

### Human input

- `approval.answer`
- `question.answer`

### Actions

- `macro.list`
- `macro.run`
- `effort.set`
- `voice.submit`

### Device

- `device.list`
- `device.revoke`

## 9. Events

- `host.snapshot`
- `host.status_changed`
- `host.capabilities_changed`
- `runtime.discovered`
- `runtime.status_changed`
- `runtime.compatibility_warning`
- `session.created`
- `session.updated`
- `session.state_changed`
- `session.summary_updated`
- `message.delta`
- `message.completed`
- `approval.requested`
- `approval.updated`
- `approval.resolved`
- `question.requested`
- `question.resolved`
- `preview.updated`
- `command.accepted`
- `command.dispatched`
- `command.confirmed`
- `command.failed`
- `sync.replay`
- `sync.reset_required`
- `bridge.error`

## 10. Command state machine

```text
received -> validated -> accepted -> dispatched -> confirmed
                                     \-> failed
```

`accepted` means the bridge persisted and accepted responsibility for the command. It does not mean the runtime executed it.

## 11. Session model

```ts
interface NormalizedSession {
  id: string;
  runtime: "codex" | "opencode" | "claude";
  runtimeSessionId: string;
  hostId: string;
  title: string;
  projectName?: string;
  state:
    | "idle"
    | "queued"
    | "running"
    | "waiting_user"
    | "waiting_approval"
    | "completed"
    | "failed"
    | "cancelled"
    | "interrupted"
    | "disconnected"
    | "unknown";
  summary: string;
  currentAction?: string;
  pendingApprovalCount: number;
  pendingQuestionCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}
```

## 12. Capabilities

Capabilities are returned per runtime and may be narrowed per session.

```ts
interface SessionCapabilities {
  send: boolean;
  steerInFlight: boolean;
  cancel: boolean;
  retry: boolean;
  resume: boolean;
  fork: boolean;
  approvals: {
    command: boolean;
    fileChange: boolean;
    network: boolean;
    filesystem: boolean;
    genericTool: boolean;
    approveForSession: boolean;
    modifyBeforeApproval: boolean;
  };
  questions: {
    singleChoice: boolean;
    multiSelect: boolean;
    freeText: boolean;
  };
  previews: {
    diff: boolean;
    tests: boolean;
    commands: boolean;
    files: boolean;
    rawTranscript: boolean;
  };
  effortLevels?: string[];
  skills: boolean;
  macros: boolean;
}
```

## 13. Approval model

```ts
type ApprovalState =
  | "pending"
  | "answering"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "resolved_elsewhere"
  | "failed";
```

Every answer contains:

- Approval ID
- Expected approval version
- Command ID
- Idempotency key
- Runtime-supported decision
- Optional feedback

The bridge uses compare-and-set semantics. First valid decision wins.

## 14. Synchronization

Phone sends:

```json
{
  "type": "host.sync",
  "payload": {
    "lastAcknowledgedSequence": 1842,
    "knownSnapshotVersion": 26
  }
}
```

### Replay response

Contains all durable events after the cursor.

### Snapshot response

Contains current runtimes, sessions, approvals, questions, and watermark sequence.

The phone acknowledges the applied watermark.

## 15. Ordering and duplication

- Each host has one monotonically increasing durable sequence.
- Events may be delivered more than once.
- Phone ignores already-applied message IDs/sequences.
- Session updates include a session version; lower versions are ignored.
- Commands are deduplicated by idempotency key.

## 16. Errors

Canonical codes:

- `AUTHENTICATION_FAILED`
- `DEVICE_REVOKED`
- `PROTOCOL_VERSION_UNSUPPORTED`
- `CAPABILITY_UNAVAILABLE`
- `RUNTIME_NOT_INSTALLED`
- `RUNTIME_OFFLINE`
- `RUNTIME_VERSION_UNSUPPORTED`
- `SESSION_NOT_FOUND`
- `SESSION_BUSY`
- `SESSION_VERSION_CONFLICT`
- `APPROVAL_ALREADY_RESOLVED`
- `APPROVAL_EXPIRED`
- `INVALID_COMMAND`
- `PAYLOAD_TOO_LARGE`
- `BRIDGE_OVERLOADED`
- `RELAY_UNAVAILABLE`
- `SYNC_CURSOR_EXPIRED`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Error shape:

```json
{
  "code": "SESSION_VERSION_CONFLICT",
  "message": "The session changed before this command was applied.",
  "retryable": true,
  "userAction": "refresh_session",
  "details": {}
}
```

## 17. Versioning

- Major protocol changes require a new integer version.
- Additive optional fields may be added within a version.
- Clients must ignore unknown optional fields.
- Unknown message types are logged and ignored only when marked noncritical.
- Unknown approval semantics must fail closed.
- Initialization negotiates the highest common supported version.

## 18. Security requirements

- Authenticated device grant before initialization
- Replay-resistant handshake
- Strict JSON Schema validation
- Frame size limits
- Rate limiting
- Redaction before mobile publication
- No secrets in errors
- Relay frames additionally encrypted end to end

## 19. MCP relationship

UCP may borrow durable-task concepts such as working, input-required, completed, failed, and cancelled. It does not assume universal MCP Tasks support. A future bridge MCP server can expose UCP sessions and commands as MCP resources/tools/tasks.
