# Auth flow — shared module (Creator + Learner)

**No dependencies.** Recommended first pilot for the Storybook workflow (small surface, real
state machine, immediately unblocks Sprint 1 identity work — see
`packages/docs/clickup-sync/sprints/sprint-1-identity-org-design-system.md`, US-001/US-002 under
Identity & Auth).

---

## Task: Build `AuthFlow` module

**What it is:** The canonical phone + OTP authentication flow — one implementation, consumed
identically by both `apps/creator` and `apps/learner`. Per the handoff's own composed mockup, only
the `onSuccess` callback and a display `appName` string differ between the two apps; everything
else (validation, OTP grid, error states, resend cooldown) is shared.

**Location:** `packages/ui/src/modules/AuthFlow.tsx` (new `modules/` subfolder inside
`packages/ui/src/`, distinct from `components/` — this is the first of the 21 composite modules
and establishes that split: `components/` = base primitives, `modules/` = feature-specific
compositions).

**Props/API** (from the handoff):
```ts
interface AuthFlowProps {
  appName: string;       // e.g. "your Creator dashboard" / "your Learner home"
  onSuccess: () => void; // fired ~1400ms after the success state renders
}
```

**Composition:** Uses `Button` (primary + secondary variants) and `Input` (`label`, `placeholder`,
`error`, `iconLeft`) from `packages/ui/src/components/`. New custom piece: a 6-digit OTP input
grid (individual boxes, not a single text field).

**Behavior — 3-step state machine** (`step: 'phone' | 'otp' | 'success'`):
- **Phone step:** validates 9–12 digit phone number via regex; inline error on invalid input.
- **OTP step:** 6 individual numeric-only boxes, auto-advance focus on digit entry, backspace
  moves back a box; error states for "wrong code" and "expired code"; 30s resend-cooldown timer;
  back-link returns to phone step.
- **Success step:** checkmark + confirmation message, calls `onSuccess()` after ~1.4s.

**Real backend note:** the handoff's validation is local-only (hardcoded demo OTP `000000`). This
task is UI/state-machine only — wiring to the real phone/OTP backend (ADR-001, Sprint 1
Identity & Auth US-001/US-002) is separate backend work already tracked in the Sprint 1 sync doc;
this module should accept the OTP-verification step as injectable (e.g. an `onVerifyOtp(code):
Promise<boolean>` prop) rather than hardcoding the demo check, so the same component works against
a mocked verifier in Storybook and the real API in the apps.

**Acceptance criteria:**
- [ ] All three steps render and transition correctly with keyboard-only interaction (OTP grid
      auto-advance/backspace, no mouse required).
- [ ] Phone validation rejects out-of-range digit counts with the documented error copy.
- [ ] Resend cooldown genuinely disables the resend action for 30s, not just visually.
- [ ] Component takes an injectable OTP-verification function rather than a hardcoded demo check.
- [ ] Storybook stories cover: phone step (empty, error), OTP step (empty, wrong-code error,
      expired error, cooldown active), success step.

## Task: Composed-page story — "Auth Flow" (both apps)

**What it is:** The Storybook equivalent of the handoff's `ui_kits/auth-flow/index.html` — a
`pages/AuthFlow.stories.tsx` in `packages/ui` demonstrating the exact same tab-switcher pattern the
handoff used (toggle between "as Creator" / "as Learner"), proving the one `AuthFlow` component
serves both apps with only `appName`/`onSuccess` varying.

**Do:** Two stories (or one story with a Storybook control toggling the app context) — `Creator`
passing `appName="your Creator dashboard"`, `Learner` passing `appName="your Learner home"`. Each
`onSuccess` logs to the Storybook Actions panel (no real navigation needed at this stage).

**Acceptance criteria:**
- [ ] Both stories render inside the same phone-frame viewport the handoff used (390×760) via a
      Storybook viewport preset, so the preview genuinely matches what the handoff showed.
- [ ] Confirms visually (for team/design review) that swapping `appName` is the only difference
      needed per app — if it isn't, that's a signal `AuthFlow`'s prop surface is incomplete.
