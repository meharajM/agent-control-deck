# Runtime Adapter Plan

## 1. Adapter strategy

The bridge uses the richest supported native interface for each runtime, then maps it to UCP. MCP, skills, and plugins supplement these integrations but do not replace native session control.

## 2. Shared adapter contract

```ts
interface AgentAdapter {
  readonly runtime: "codex" | "opencode" | "claude";

  probe(): Promise<RuntimeProbe>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getCapabilities(): Promise<RuntimeCapabilities>;

  listSessions(): Promise<RuntimeSession[]>;
  getSession(runtimeSessionId: string): Promise<RuntimeSession>;
  createSession(input: CreateSessionInput): Promise<RuntimeSession>;
  resumeSession(runtimeSessionId: string): Promise<void>;
  forkSession?(runtimeSessionId: string, options?: ForkOptions): Promise<RuntimeSession>;

  send(runtimeSessionId: string, input: NormalizedUserInput): Promise<RuntimeActionReceipt>;
  steer(runtimeSessionId: string, input: NormalizedUserInput): Promise<RuntimeActionReceipt>;
  cancel(runtimeSessionId: string): Promise<RuntimeActionReceipt>;

  answerApproval(
    approval: RuntimeApprovalReference,
    answer: NormalizedApprovalAnswer
  ): Promise<RuntimeActionReceipt>;

  answerQuestion(
    question: RuntimeQuestionReference,
    answer: NormalizedQuestionAnswer
  ): Promise<RuntimeActionReceipt>;

  reconcile(cursor?: RuntimeCursor): Promise<ReconcileResult>;
  subscribe(listener: (event: RuntimeEvent) => Promise<void>): Promise<() => Promise<void>>;
}
```

## 3. Adapter rules

- Do not fabricate support.
- Preserve runtime IDs.
- Validate payloads.
- Keep raw payloads out of normal logs.
- Unknown approval decisions fail closed.
- Reconcile after every adapter/runtime restart.
- Separate runtime ownership mode: managed or attached.
- Publish capabilities only after a successful probe.

## 4. Codex adapter

### Recommended interface

Use `codex app-server`.

Preferred transports:

1. stdio/JSONL
2. Unix socket
3. TCP WebSocket only as an advanced experimental option

### Startup

1. Locate Codex binary.
2. Read installed version.
3. Generate or load version-matched TypeScript/JSON schemas.
4. Launch app-server over stdio.
5. Perform initialize/initialized handshake.
6. List/resume threads.
7. Subscribe to turn/item/request events.
8. Reconcile persisted sessions.

### Mapping

- Thread -> normalized session
- Turn -> unit of work
- Item/message events -> normalized messages/previews
- Request-approval events -> normalized approvals
- Request-user-input -> normalized questions
- Turn interruption -> cancel
- `turn/steer` -> in-flight steering

### Backpressure

Treat server-overloaded responses as retryable with exponential backoff and jitter. Do not retry state-changing operations without the bridge command ledger.

### Schema policy

- Generate stable schemas from the installed version when possible.
- Keep tested schema fixtures in adapter tests.
- Experimental API requires explicit feature flag and separate compatibility matrix.

### Recovery

- Persist Codex thread ID.
- On bridge restart, list/resume known threads.
- Rebuild state from available thread/turn/items.
- Pending approvals are actionable only if the runtime still reports them.

## 5. OpenCode adapter

### Recommended interface

Use the headless OpenCode HTTP server and its OpenAPI-generated SDK.

Default safe process:

```text
opencode serve --hostname 127.0.0.1 --port <allocated>
```

Set a generated server password and keep the server on loopback. The bridge—not the phone—connects to it.

### Startup

1. Detect existing configured server or launch managed server.
2. Call global health and read version.
3. Validate OpenAPI compatibility.
4. Authenticate.
5. Subscribe to global or instance SSE events.
6. List sessions and status.
7. Reconcile permissions and diffs.

### Core API mapping

- List/create/get/update/fork session
- Async prompt
- Abort
- Session messages
- Session diff
- Permission response
- Session command
- Health/version
- SSE events

### Permission posture

OpenCode user permission configuration remains authoritative. Setup may recommend stricter prompts for edit, shell, external directories, and network operations but must never silently rewrite policy.

### Recovery

- Persist session ID and last event cursor when available.
- On reconnect, query sessions/status/messages/permissions/diffs.
- Rebuild normalized state before accepting new commands.

## 6. Claude adapter

### Primary mode: bridge-managed Agent SDK sessions

Use current Claude Agent SDK APIs. Avoid the removed experimental TypeScript V2 session API. Implement with `query()` plus session identifiers, `resume`, `fork`, partial-message streaming, permission callbacks, and current documented session utilities.

### Authentication

Use supported Agent SDK authentication. Do not offer unofficial claude.ai login passthrough. API/provider credentials remain on the host.

### Session lifecycle

- Start `query()` with project working directory and configured setting sources.
- Capture session ID from init/result messages.
- Persist session ID and cwd.
- Resume by exact session ID and matching cwd.
- Use fork when the user requests an alternate branch.
- Sessions persist conversation history, not a filesystem snapshot.

### Streaming

Enable partial output only when required for responsive state. Aggregate token deltas into meaningful mobile messages to reduce bandwidth and UI noise.

### Approvals/questions

Use permission and user-input callbacks to:

1. Persist a normalized request.
2. Emit it to paired clients.
3. Wait on a durable bridge coordination primitive.
4. Return the user decision.
5. Persist runtime confirmation/result.

Do not rely only on an in-memory promise. If a bridge restart interrupts the callback, reconcile/resume or mark the request interrupted.

### Project features

Allow user/project/local setting sources as explicitly configured so Claude skills, hooks, commands, and project instructions can be loaded. Document the security impact.

### External CLI attachment

Treat attachment to arbitrary independently launched Claude Code CLI sessions as experimental. Use only supported plugins/hooks/channels. Do not reverse engineer first-party remote-control protocols.

## 7. Capability matrix for first release

| Capability | Codex | OpenCode | Claude managed |
|---|---:|---:|---:|
| List sessions | GA | GA | Beta |
| Create session | GA | GA | Beta |
| Resume | GA | GA/derived | Beta |
| Stream output | GA | GA | Beta |
| In-flight steer | Native where available | Adapter-defined based on API | Limited by SDK flow |
| Cancel | GA | GA | Beta |
| Structured approvals | GA | GA | Beta |
| Questions | GA where surfaced | API/event dependent | Beta |
| Diff preview | Native/derived | Native | Derived/runtime tools |
| Effort control | Capability dependent | Provider/model dependent | Permission/model dependent |

## 8. Compatibility policy

Each adapter publishes:

- Adapter version
- Minimum supported runtime
- Maximum tested runtime
- Experimental features
- Disabled features
- Last compatibility test date

Newer-than-tested runtimes enter compatibility mode. Unknown approval structures disable remote approval until verified.

## 9. Contract tests

Every adapter must pass:

- Probe/start/stop
- Session list/create/get
- Send and stream
- Cancel
- Approval allow/deny
- Question response
- Runtime restart
- Bridge restart
- Duplicate command
- Reconciliation
- Unsupported capability
- Unknown event
- Backpressure/rate limit behavior
