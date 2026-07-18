# Accessibility Plan

## 1. Principle

Minimal controls must be easy to perceive and operate for users with visual, motor, speech, hearing, or cognitive accessibility needs.

## 2. Required standards

- Native accessibility roles, labels, states, and hints
- Minimum 48x48 dp touch targets
- Platform text scaling
- Logical focus order
- No color-only status
- No gesture-only critical action
- Reduced-motion support
- Text alternative to voice

## 3. Screen reader behavior

### Session tile

Announce runtime, project, state, current action, pending attention count, and freshness.

### Approval

Announce risk first, then action, scope, reversibility, and available decisions.

### Streaming

Do not announce token deltas. Announce meaningful completed messages and state transitions.

### Connection loss

Announce once, not repeatedly during retries.

## 4. Voice equivalence

Everything possible by voice must be possible by text. The user can edit transcription and explicitly send it.

## 5. Visual design

- Use icon + label + state text
- Avoid low-contrast muted critical text
- Allow multiline text
- Avoid fixed-height controls
- Maintain focus visibility

## 6. Test checklist

- iPhone VoiceOver physical device
- Android TalkBack physical device
- Largest text size
- Grayscale
- High contrast
- Reduced motion
- Screen magnification
- External keyboard
- One-handed reachability review
