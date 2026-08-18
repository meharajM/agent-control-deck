# Product Features and App Behavior

## 1. Product objective

Agent Deck is a minimal mobile supervision interface for coding agents. It deliberately avoids becoming a mobile terminal or IDE. The product should expose the smallest amount of context that lets a user make a safe decision.

## 2. Core product problems

### Runtime fragmentation

Codex and OpenCode are the v1 runtimes and use different session models, event formats, permission mechanisms, and transports. The phone must not implement these protocols independently. A local host bridge normalizes them. The bridge remains extensible for post-v1 runtimes such as Claude Code, but those runtimes are outside the v1 product scope.

### Attention fragmentation

Users currently need to watch several terminals or runtime-specific interfaces. Agent Deck creates one attention queue for approvals, questions, failures, and completions.

### Excessive context

Raw transcripts, diffs, and terminal output are too dense for the primary mobile view. The app uses progressive disclosure: summary first, risk detail second, raw data only on request.

### Unreliable mobile connectivity

Sockets fail, mobile apps sleep, and networks change. The app must recover from persisted state rather than assuming a continuous connection.

### Unsafe remote decisions

Approvals must preserve exact runtime semantics, raw commands, paths, network destinations, and risk-relevant details. Model-generated explanations are advisory and cannot replace deterministic information.

## 3. Product principles

1. **Local first:** core control works over LAN or a user-managed private network.
2. **Server optional:** hosted relay and account services enhance convenience but never become required for local operation.
3. **Control deck first:** the default screen shows every active agent and makes attention states dominant within that surface.
4. **Minimal by default:** summaries before transcripts.
5. **No false confirmation:** distinguish accepted, dispatched, confirmed, and completed states.
6. **Runtime-native safety:** do not weaken sandbox or permission behavior.
7. **Capability-driven UI:** render controls from negotiated capabilities.
8. **Accessible equivalence:** every voice or gesture feature has a text/control equivalent.
9. **Offline honesty:** cached data is visibly stale; dangerous controls are disabled.
10. **Extensible bridge, bounded app:** add adapters and skills without turning the app into an IDE.

## 4. Primary personas

### Multi-agent developer

Runs multiple sessions and wants a compact board, completion alerts, and quick steering.

### Reviewer

Lets agents implement work and uses the phone to inspect summaries, tests, and approval requests.

### Privacy-focused self-hoster

Uses LAN or Tailscale, keeps prompts local, and avoids a vendor account.

### Accessibility-first user

Requires VoiceOver/TalkBack, large text, large targets, and full text alternatives to voice.

### Extension author

Builds runtime adapters, portable skills, or organization-specific quick actions.

## 5. Information architecture

The primary mobile experience is one control-deck screen. It has no persistent bottom navigation.

The control deck contains, in order:

1. Host connection state and one overflow menu.
2. An adaptive grid containing every active agent.
3. Inline details for the selected agent.
4. Contextual attention requests.
5. Configurable command keys.
6. Text steering.

Pairing replaces the deck when no host is paired. Session history, diagnostics, host setup, and settings remain secondary routes opened from the overflow menu. Approval detail and expanded session detail remain drill-in routes because safe decisions may require more context than the deck can show.

## 6. Control deck

### Agent inclusion

Show every session in a working, queued, waiting-user, waiting-approval, failed, or interrupted state. Do not impose a product-level maximum below the architecture target of 20 active sessions; the deck scrolls as needed.

Completed sessions remain on the deck for one hour after their authoritative completion timestamp. A user may dismiss a completed session earlier. Dismissal is a phone-local display preference and survives app restart. Idle, cancelled, and expired completion tiles remain available in session history but do not occupy the deck.

### Sorting

1. Waiting for approval or user input
2. Failed or interrupted
3. Running
4. Queued
5. Recently completed

Within a state group, show the most recently updated agent first.

### Agent key requirements

Each key contains:

- Human-readable session title
- State label and icon
- Pending approval/question count
- Stale badge when disconnected

Color may reinforce state but never replaces the state label, symbol, accessibility label, or selected treatment.

### Normalized UI states

| Internal state | User label | Behavior |
|---|---|---|
| idle, queued | Ready | Allows new prompt |
| running | Working | Shows progress and stop/steer controls |
| waiting_user, waiting_approval | Needs you | Prominent attention state |
| completed | Done | Shows summary and follow-up actions |
| failed, interrupted | Problem | Shows failure reason and retry options |
| disconnected, unknown | Offline | Read-only cached view |

State is never communicated using color alone.

## 7. Selection and desktop focus

Tapping an agent key performs two independent actions:

1. Select the agent and reveal its details on mobile immediately.
2. Request that the host focus the exact corresponding session in the computer UI.

Mobile detail must never depend on focus succeeding. Focus is capability-gated through `desktopFocus` and is shown only after the bridge has proven that it can target the exact session. The bridge acknowledges success only after the host integration confirms focus. A failure remains visible beside the selected details and offers another attempt; it is never silent.

The product goal is that focus does not fail on a supported host integration. Closed desktop applications, revoked OS automation permissions, missing sessions, and unsupported shells are explicit degraded states. A bridge without a verified integration must not advertise `desktopFocus`.

## 8. Selected agent details

### Always visible

- State
- Current action
- Runtime
- Host
- Project
- Elapsed time
- Last updated time

### Primary controls

- Type instruction
- Push-to-talk
- Send/steer
- Stop
- Quick actions

The essential detail is presented inline on the control deck. The expanded detail route remains available for plans, previews, tests, command activity, and raw details.

### Expandable sections

- Current plan
- Recent meaningful messages
- Changed files
- Test results
- Command activity
- Raw details

Raw token-by-token output should not be announced to screen readers. Aggregate meaningful messages before announcing.

## 9. Approval behavior

### Approval card content

- Exact action category
- Runtime-provided reason
- Deterministic bridge summary
- Exact command, path, destination, or tool when applicable
- Working directory
- Affected file count and sensitive paths
- Risk level
- Reversibility
- Available native decisions
- Whether a decision can persist for the session

### Decision states

```text
pending -> answering -> approved/rejected/cancelled/expired/resolved_elsewhere
```

The phone does not remove a card after sending a response. It waits for the bridge/runtime authoritative resolution or a later snapshot.

### Offline restrictions

Approve, reject, cancel, retry, and send are disabled whenever the app cannot prove a current authenticated connection.

### Biometrics

High-risk actions may require a system biometric check. Biometrics prove possession of the paired device; they do not prove that an agent request is safe.

## 10. Question behavior

Support:

- Single choice
- Multiple choice
- Free text
- Runtime-provided descriptions
- Optional “Other” response when supported

The bridge preserves runtime question IDs and prevents duplicate responses.

## 11. Input behavior

### New prompt

Used when a session is idle/completed or the runtime supports a new turn.

### Steer

Used when a runtime supports in-flight steering. The UI labels it “Steer current work,” not “Send,” when behavior differs.

### Draft handling

- Drafts are local to the phone.
- Drafts survive app restart.
- Drafts never auto-send after reconnection.
- The user reviews any recovered voice transcript before sending.

## 12. Push-to-talk behavior

1. Press and hold.
2. Visual and haptic feedback appears within 100 ms.
3. Transcription runs locally when possible.
4. Transcript appears as editable text.
5. User explicitly sends or cancels.

Voice is a convenience layer over the normal text command path.

## 13. Quick actions

Initial actions:

- Summarize current work
- Explain the blocker
- Review current diff
- Run relevant tests
- Summarize test failures
- Prepare handoff
- Continue with lowest-risk option
- Stop after current step
- Create commit-message draft

Actions are hidden or disabled based on runtime/session capabilities.

The control deck pins three actions by default: Summarize current work, Run relevant tests, and Stop. Defaults are replaced by available actions when a capability is absent. Users may pin any number of actions exposed for the selected session. Pinned actions scroll horizontally rather than expanding the primary layout into a dashboard. Configuration is phone-local and survives app restart.

## 14. Host behavior

Host states:

- Starting
- Reconciling
- Online direct
- Online private network
- Online relay
- Degraded
- Offline

Host details show:

- Last seen
- Connection route
- Bridge version
- Installed runtimes
- Adapter health
- Paired devices
- Start-on-login status

## 15. Reconnection behavior

On socket loss:

1. Mark connection degraded after configured timeout.
2. Keep cached content visible.
3. Disable state-changing controls.
4. Retry with exponential backoff and jitter.
5. On reconnect, send last acknowledged event sequence.
6. Apply replay or transactional snapshot.
7. Re-enable controls only after synchronization completes.

## 16. Notification behavior

Push notification payloads are generic:

- Agent needs approval
- Agent needs input
- Task completed
- Task failed
- Host disconnected

Project names, prompts, paths, commands, and diffs are fetched only after an authenticated encrypted connection is restored.

Without an optional server, the app still works when foregrounded. Remote background push delivery may require a managed push service later.

## 17. Accessibility behavior

- Minimum 48x48 dp targets
- VoiceOver and TalkBack labels, roles, states, and hints
- Dynamic type and Android font scaling
- Logical focus order
- No swipe-only approvals
- Reduced-motion support
- Text alternative to voice
- Haptics supplement but never replace visible/audible state
- High-contrast and grayscale testing

## 18. Empty and error states

### No host paired

Replace the deck with one pairing-code entry point and a concise LAN/private-network explanation. After synchronization, return directly to the control deck.

### No runtime found

Show detected system details and runtime-specific setup instructions.

### Runtime incompatible

Show installed version, maximum tested version, disabled capabilities, and safe upgrade/downgrade guidance.

### Relay unavailable

Attempt direct/private routes; otherwise show stale cached state.

### Bridge database recovery

Mark host “Recovering,” avoid accepting commands, and provide a sanitized diagnostic export if recovery fails.

## 19. Product boundaries

Reject or defer features that primarily turn Agent Deck into:

- A file manager
- A terminal
- A mobile editor
- A Git client
- A remote desktop

A feature belongs in the core app only when it improves supervision, decision making, or concise steering.
