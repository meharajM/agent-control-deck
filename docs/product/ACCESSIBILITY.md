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

### Agent key

Announce the session title, state, pending attention count, selected state, and freshness. Expanded details announce runtime and project metadata when available.

The selected state is announced independently of color. Every key has at least a 48x48 dp target, and the adaptive grid remains operable at maximum text scale.

### Desktop focus

Selecting an agent always reveals mobile detail. Announce desktop-focus success or failure once through a polite live region. Focus failure must not move accessibility focus away from the selected mobile details, and retry must be a labeled control when the capability is available.

### Command configuration

Command toggles expose checkbox state and readable labels. Horizontal command scrolling must also be operable with screen readers and external keyboards; no command may require a swipe-only gesture.

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
